
---
title: MySQL之Innodb之快照读原理实现
date: 2022-01-13T11:14:15+08:00
weight: 70
slug: mysql-snapshot-read
tags: ["源码"]
categories: ["MySql"]
author: "清水"
comments: true
share: true
draft: false
---

# Innodb之快照读原理实现


#   1 Innodb MVCC组成

### 1. 1 为何使用MVCC实现快照读
innodb存储引擎的快照读是基于多版本并发控制 MVCC 和 undolog 实现，通过 MVCC 机制提高系统读写并发性能，快照读只发生于 select 操作，但不包括 **select ... lock in share mode, select ... for update**　　　　



* 提高并发的思路
> 并发数据一致性通常实现: 锁 + 多数据版本
> 提高并发读的思路: 通过共享锁保证读读并发，独占锁实现读写互斥
> 提高并发读写的思路: 一致性折衷，通过数据多版本控制，读使用快照版本，读写不互斥，提高读写并发能力 


### 1.2  MVCC 相关概念
InnoDB的MVCC实现基于`undo log`，通过`回滚段`保存 undo log 记录版本快照数据，通过`readview`机制来确定`数据的可见性`，通过 purge 线程基于 readview 来清理旧数据版本

##### 1.2.1  undolog
* mysql 事务未提交前，会将事务修改前的**旧版本数据**存放到 undo 日志里，用于事务回滚或者数据库奔溃对数据库数据的影响，来保证数据的原子性。
* undo 日志会存储在`回滚段`中,分为:` insert undo log` 和 `update undo log`

##### 1.2.2 readview
* readview 主要用于可见性判断
* 在 repeatable read 隔离级别，快照的产生只会在事务开启后第一个 select 读操作后创建 readview 快照
* 在 read committed 隔离级别，事务中的每一个 select 读操作都会创建 read view 快照

##### 1.2.3 三个隐式字段 


| 字段 | 含义 | 存储位置 | 大小 |
|  :--:  | :--:  |  :--:  |  :--:  |
| **DB_TRX_ID** |       最后更新的事务 id(update,delete,insert)       | 表数据行和聚簇索引上 | 占6字节 |
| **DB_ROLL_PTR** | 回滚指针，指向前一个版本的 undolog 记录，组成 undo 链表 | 表数据行和聚簇索引上 | 占7字节 |
| **DB_ROW_ID** | 数据行 id，单调递增 | 表数据行和聚簇索引上 | 占6字节 |




# 2 Innodb MVCC 实现（5.6.x版本）
### 2.1 多版本实现

##### 2.1.1 事务快照更新过程

假设`user`表中 字段`id`为**聚簇索引**，字段`name` 为**非聚簇索引**

* 步骤1 创建记录
```sql
INSERT INTO `user`(`id`, `name`, `score`) VALUES (9, 'zhang3', 60)
```

如图所示：

![undolog-insert001](/media/mysql-snapshot-read/undolog-insert001.png)
 


插入之后生成的数据行上有三个隐式字段：分别对应该行的行 id 标识、最新事务 id 标识和回滚指针，以及对应的业务属性数据

* 步骤2 聚簇索引更新记录

```sql
 update table `user` set `score`= 70 where id=9
```

如图所示：

 ![undolog-update001](/media/mysql-snapshot-read/undolog-update001.png)



>1 对 id 为9的数据行加X锁
>2 写旧版本数据到 undo log
>3 更新数据行，修改 DB_TRX_ID 为667, 回滚指针指向拷贝到 undo log 的旧版本
>4 更新聚簇索引所在行的 DB_TRX_ID 和 DB_ROLL_PTR
>5 事务提交，释放锁




* 步骤3 非聚簇索引更新记录

  ```sql
   update table `user` set `score`= 80 where `name` = 'zhang3'
  ```

  
  
  如图所示：

 ![undolog-update002](/media/mysql-snapshot-read/undolog-update002.png)

二级索引更新

 ![undolog-update003](/media/mysql-snapshot-read/undolog-update003.png)

> 1 对 id 为9的数据行加X锁
> 2 写旧版本数据到 undo log
> 3 更新数据行，修改 DB_TRX_ID 为668, 回滚指针指向拷贝到 undo log 的旧版本
> 4 标记Page当前所在行 **DELETED BIT** 为被删除
> 5 插入新的索引行记录并更新所在 Page 页的最大**trx_id**
> 6 更新聚簇索引所在行的 DB_TRX_ID 和 DB_ROLL_PTR
> 7 事务提交，释放锁


* 总结

  通过多次更新，旧版本快照通过回滚指针串联成一个链表

  同时 undolog 日志会通过 purge 线程查询比当前活跃的最老的事务id的回滚日志进行删除操作




### 2.2 readview 可见性判断

##### 2.2.1 可见性判断流程
* readview 结构体包含如下几个属性

| 字段 | 含义 |
|  :--:  | :--:  |
| **creator_trx_id** |   创建该视图的事务 ID |
| **trx_ids** | 创建 ReadView 时，活跃的读写事务 ID 数组，有序存储 |
| **low_limit_id** | 设置为当前最大事务 ID |
| **up_limit_id** | m_ids 集合中的最小值 |

* 可见性算法

 ![see-001](/media/mysql-snapshot-read/see-001.png)

在RC或者RR级别下开启事务时会生成一个 readview 快照，当 select 查询到一条数据时，会根据该数据的 trx_id 与 readveiw 中的数据进行可见性比对，可见性算法如下：

- 如果记录行的`trx_id`小于`read_view_t::up_limit_id`，则说明该事务在创建 ReadView 时已经提交了，肯定可见
- 如果记录行的`trx_id`大于等于`read_view_t::m_low_limit_id`，则说明该事务是创建 readview 之后开启的，肯定不可见
- 当`trx_id`在`up_limit_id`和`low_limit_id`之间，并且在`read_view_t::trx_ids`数组中，则说明创建  readview 时该事务是活跃的，其数据变更对当前视图不可见，如果不在活跃事务列表`trx_ids`中则对该`trx_id`的变更可见



##### 2.2.2 RR 级别可重复读流程
* 数据准备

```sql
CREATE TABLE `user` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_bin NOT NULL,
  `scores` int(10) NOT NULL,
  `status` bigint(20) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


BEGIN;
INSERT INTO `user` VALUES (1, 'wang5', 33, 2);
INSERT INTO `user` VALUES (2, 'zhao6', 23, 2);
INSERT INTO `user` VALUES (9, 'zhang3', 12, 1);
COMMIT;

```

* 步骤1 新启动两个事务AB

  ```sql
  -事务A
  set session transaction isolation level repeatable read
  BEGIN
  SELECT * from user where id = 1
  # 查询当前会话事务id
  select TRX_ID from INFORMATION_SCHEMA.INNODB_TRX where TRX_MYSQL_THREAD_ID = CONNECTION_ID();
  
  -事务B
  set session transaction isolation level repeatable read
  BEGIN
  SELECT * from user where id = 9
  # 查询当前会话事务id
  select TRX_ID from INFORMATION_SCHEMA.INNODB_TRX where TRX_MYSQL_THREAD_ID = CONNECTION_ID();
  ```

  事务A之后发起事务B， 并查询当前会话事务 id 分别为 710 和 711，通过 readview 机制可知，当前事务B的 readView 快照如下

   ![readview-001](/media/mysql-snapshot-read/readview-001.png)



* 步骤2 事务A 更新提交得分数据

  ```sql
  -事务A
  UPDATE user set scores = 112 where id = 1
  commit
  ```

  此时事务A会生成 undolog 旧版本快照, 事务B的 readview 快照还是如下图：

  ![readview-002](/media/mysql-snapshot-read/readview-002.png)

  在RR级别下 readview 中的活跃事务 trx_ids 还是[710, 711]，事务B `SELECT * from user where id = 1`操作

  根据可见性算法可知，查询到最新记录行 trx_id 的记录，发现当前事务 ID 在事务活跃列表，所以要去 undolog 里查询就版本。旧数据的记录行 trx_id 为709的，小于 up_limit_id 最小事务 id, 所以可见，最终显示 score 为33

  

* 步骤3 事务C 插入数据

  ```sql
  -事务C
  set session transaction isolation level repeatable read
  BEGIN
  INSERT INTO `user`(`name`, `scores`, `status`) VALUES ('li4', 55, 1)
  # 查询当前会话事务id
  select TRX_ID from INFORMATION_SCHEMA.INNODB_TRX where TRX_MYSQL_THREAD_ID = CONNECTION_ID();
  COMMIT
  ```

  事务C的 trx_id 为712，此时事务B再次发起查询 `SELECT * from user where id > 8` 根据可见性算法可知，

  查询到 id 为9和10两条记录记录，但是 id 为10的记录 trx_id = 712，超过了  readview 快照的最大记录所以不可见，undo 日志也没有旧版本记录，最终只能查询到 id=9 的记录



### 2.3  快照读源码解析

##### 2.3.1 InnoDB三个隐藏字段源码

* 表数据行会添加`dict0dict.cc#dict_table_add_system_columns`方法

  ```c++
  /**
   * 添加数据行的隐藏字段
   * @param table  
   * @param heap 
   */
  void dict_table_add_system_columns(
  	dict_table_t*	table,
  	mem_heap_t*	heap)	
  {
  
    // 按顺序添加行id，事务id，回滚指针
  	dict_mem_table_add_col(table, heap, "DB_ROW_ID", DATA_SYS,
  			       DATA_ROW_ID | DATA_NOT_NULL,
  			       DATA_ROW_ID_LEN);
  
  	dict_mem_table_add_col(table, heap, "DB_TRX_ID", DATA_SYS,
  			       DATA_TRX_ID | DATA_NOT_NULL,
  			       DATA_TRX_ID_LEN);
  
  	dict_mem_table_add_col(table, heap, "DB_ROLL_PTR", DATA_SYS,
  			       DATA_ROLL_PTR | DATA_NOT_NULL,
  			       DATA_ROLL_PTR_LEN);
  
  }
  ```



* 聚簇索引会添加 `row0upd.cc#row_upd_index_entry_sys_field`方法

```c++
/**
 * 设置事务id或回滚指针到聚簇索引对应的记录行
 * @param entry 数据行记录
 * @param index 聚簇索引
 * @param type 类型 DATA_TRX_ID or DATA_ROLL_PTR
 * @param val  更新的值
 */
void row_upd_index_entry_sys_field(
	dtuple_t*	entry,	
	dict_index_t*	index,
	ulint		type,
	ib_uint64_t	val)	
{
	dfield_t*	dfield;
	byte*		field;
	ulint		pos;
    // 查询索引隐藏字段初始位置
	pos = dict_index_get_sys_col_pos(index, type);
    // 获取对应数据记录行的指针
	dfield = dtuple_get_nth_field(entry, pos);
	field = static_cast<byte*>(dfield_get_data(dfield));
    // 添加类型
	if (type == DATA_TRX_ID) {
		trx_write_trx_id(field, val);
	} else {
		ut_ad(type == DATA_ROLL_PTR);
		trx_write_roll_ptr(field, val);
	}
}
```

聚簇索引上会存储额外信息，6字节的 DB_TRX_ID 字段，表示最新插入或者更新该记录的事务 ID。7字节的 DB_ROLL_PTR 字段，指向该记录的 rollback segment 的 undo log 记录。6字节的 DB_ROW_ID，当有新数据插入的时候会自动递增。若表未没有设置主键，InnoDB 会自动产生聚集索引，包含 DB_ROW_ID 字段。



##### 2.3.2 readview 的执行流程

* readview 数据结构

  ```c++
  struct read_view_t{
    
    // 等于low_limit_id
  	trx_id_t	low_limit_no;
  			
    // 最大事务id
  	trx_id_t	low_limit_id;
  			
    // 最小事务id
  	trx_id_t	up_limit_id;
  			
    // 活跃事务的个数
  	ulint		n_trx_ids;
  				
    // 活跃事务
  	trx_id_t*	trx_ids;
    
    // 创建快照是的事务id
  	trx_id_t	creator_trx_id;
  			
  	UT_LIST_NODE_T(read_view_t) view_list;
  };
  ```

* 确定当前读or快照读判断流程 `row0sel.cc#row_search_for_mysql`方法

  ```c++
    // 如果加锁则为当前读
  	if (prebuilt->select_lock_type != LOCK_NONE) {
      // 省略
    }else {
      // 不加锁则为快照读
  		if (trx->isolation_level == TRX_ISO_READ_UNCOMMITTED) {
      // 读未提交直接最新记录行
  		} else if (index == clust_index) {
      // 如果当前索引是聚簇索引
  		
        // 直接可见性判断
  			if (UNIV_LIKELY(srv_force_recovery < 5)
  			    && !lock_clust_rec_cons_read_sees(
  				    rec, index, offsets, trx->read_view)) {
  
  				rec_t*	old_vers;
          // 不可见则通过undo日志获取记录行上一个版本
  				err = row_sel_build_prev_vers_for_mysql(
  					trx->read_view, clust_index,
  					prebuilt, rec, &offsets, &heap,
  					&old_vers, &mtr);
  
  				if (err != DB_SUCCESS) {
  
  					goto lock_wait_or_error;
  				}
  
  				if (old_vers == NULL) {
  					goto next_rec;
  				}
          // 赋值成老版本
  				rec = old_vers;
  			}
  		} else {
        // 非聚簇索引可见性判断
  
  			ut_ad(!dict_index_is_clust(index));
  			// 如果不可见尝试索引下推，查看聚簇索引上的记录行，通过行上的DB_TRX_ID判断可见性
        // 二级索引不含隐藏列，只有page的最大trx_id
  			if (!lock_sec_rec_cons_read_sees(
  				    rec, trx->read_view)) {
  				switch (row_search_idx_cond_check(
  						buf, prebuilt, rec, offsets)) {
          // ICP 未满足条件且未超扫描范围，则获取下一条记录继续查找
  				case ICP_NO_MATCH:
  					goto next_rec;
  				case ICP_OUT_OF_RANGE:
          // 如果不满足条件且超扫描范围
  					err = DB_RECORD_NOT_FOUND;
  					goto idx_cond_failed;
  				case ICP_MATCH:
          // 如果 ICP匹配到记录，则回查聚簇索引进行可见性判断
  					goto requires_clust_rec;
  				}
  				ut_error;
  			}
  		}
  	}
  
  ```



对于非聚簇索引，因为没有聚簇索引中的隐藏列，所以当快照读命中二级索引时，会先调用`lock_sec_rec_cons_read_sees`判断 page 上记录的**最新一次修改的 trx_id 是否小于 up_limit_id**，如果小于即该 page 页上数据可见，否则会回查聚簇索引上的记录行，通过行上的 DB_TRX_ID 判断可见性，找到正确的可见版本数据



* readview 的开启``row0sel.cc#row_search_for_mysql` &rarr;  `trx_assign_read_view` 方法

```c++
trx_assign_read_view(
	trx_t*	trx)	
  
{
	ut_ad(trx->state == TRX_STATE_ACTIVE);
  // 如果有则返回
	if (trx->read_view != NULL) {
		return(trx->read_view);
	}
  // 没有则创建
	if (!trx->read_view) {
		trx->read_view = read_view_open_now(
			trx->id, trx->global_read_view_heap);

		trx->global_read_view = trx->read_view;
	}
  // 返回快照
	return(trx->read_view);

}

```

具体流程`trx_assign_read_view` &rarr; `read_view_open_now`  &rarr;  `read_view_open_now_low`  



* readview 的关闭 `ha_innodb.cc#ha_innobase::external_lock` 方法

```c++
	if (trx->n_mysql_tables_in_use == 0) {

		trx->mysql_n_tables_locked = 0;
		prebuilt->used_in_HANDLER = FALSE;
    // autocommit=1，提交事务
		if (!thd_test_options(
				thd, OPTION_NOT_AUTOCOMMIT | OPTION_BEGIN)) {
      // 提交事务或标记sql语句结束
			if (trx_is_started(trx)) {
				innobase_commit(ht, thd, TRUE);
			}
    // 事务隔离级别小于等于RC级别删除快照
		} else if (trx->isolation_level <= TRX_ISO_READ_COMMITTED
			   && trx->global_read_view) {
      // 关闭快照
			read_view_close_for_mysql(trx);
		}
	}


/**
 * 事务隔离级别小于等于RC级别调用
 * @param trx 
 */
void read_view_close_for_mysql(
	trx_t*		trx)	
{
	ut_a(trx->global_read_view);

	read_view_remove(trx->global_read_view, false);

	mem_heap_empty(trx->global_read_view_heap);
  // 快照设置为 NULL
	trx->read_view = NULL;
	trx->global_read_view = NULL;
}
```

从这里可以知道RR隔离级别，快照的产生只会在事务开启后第一个 select 读操作后创建 readview 快照，并且事务未提交前不会删除，对于RC隔离级别，事务中的每一个 select 读操作都会创建 readview 快照



*  事务可见性判断 `lock_clust_rec_cons_read_sees` &rarr;  `read_view_sees_trx_id`

```c++
/**
 *  可见性判断流程
 * @param view  当前事务readview快照
 * @param trx_id 数据行对应的事务id
 * @return
 */
bool read_view_sees_trx_id(
	const read_view_t*	view,	
	trx_id_t		trx_id)
{
    // 如果小于当前事务的最小id
	if (trx_id < view->up_limit_id) {

		return(true);
  // 如果大于等于当前事务快照的最大id
	} else if (trx_id >= view->low_limit_id) {

		return(false);
	} else {
    // 如果在两者之间
		ulint	lower = 0;
		ulint	upper = view->n_trx_ids - 1;

		ut_a(view->n_trx_ids > 0);
    // 基于当前活跃的事务数组，通过二分法查找比较trx_id是否存在其中
		do {
			ulint		mid	= (lower + upper) >> 1;
			trx_id_t	mid_id	= view->trx_ids[mid];

			if (mid_id == trx_id) {
				return(FALSE);
			} else if (mid_id < trx_id) {
				if (mid > 0) {
					upper = mid - 1;
				} else {
					break;
				}
			} else {
				lower = mid + 1;
			}
		} while (lower <= upper);
	}
    // 不在活跃事务中则当前数据行可见
	return(true);
}
```




# 3 参考资料
数据库多版本实现内幕

[引擎特性 · InnoDB MVCC 相关实现](http://mysql.taobao.org/monthly/2018/11/04/)