---
title: mysql之innodb自增锁原理实现
date: 2022-05-11T11:14:15+08:00
weight: 70
slug: mysql-auto-inc
tags: ["源码"]
categories: ["MySql"]
author: "nicky_chin"
comments: true
share: true
draft: false
---

# mysql之innodb自增锁原理实现

# 1 自增锁知识点



### 1.1 定义

自增锁是一种表级锁（table-level lock），专门针对插入 AUTO_INCREMENT 类型的列。同一表，假设事务 A 正在插入数据，则另一个事务 B 尝试 INSERT 语句，事务 B 会被阻塞住，直到事务 A 释放自增锁，以便事务A插入的行是连续的主键 ID



### 1.2 插入方式

| 插入方式 | 解释 |
|  :--:  | :--:  |
|  **Simple Inserts（简单插入）**   | 可以预估插入行数的语句（普通的 insert/replace into语句）<br />但不包含像 insert … on duplicate key update … 插入或者更新的语句 |
|   **Bulk Inserts（批量插入）**    | 无法预估插入行数的语句（包括 insert ... select, replace ... select 和 load data 语句 ） |
| **Mixed-mode insert  (混合插入)** | 类似 insert into t1(id, age) values (1,"zhang3"),(null, "li4"),(5,"wang5");<br />有些行指定了自增id，有些行未指定自增id |



### 1.3 自增锁模式
| 模式 | 解释 | innodb_autoinc_lock_mode |
|  :---:  | :--:  |  :--:  |
| **传统模式** | 执行语句时加 AUTO-INC 表级锁，statement 语句执行完毕后释放 | 0 |
| **连续模式** | 针对*批量插入* 时会采用 AUTO-INC 锁，针对*简单插入*时，采用轻量级的互斥锁 | 1 |
| **混合模式** | 不使用 AUTO-INC 表级锁 ，采用轻量级的互斥锁 | 2 |

> 传统模式 :  在 innoDB 没有 引入了**锁模式**之前默认的方式，表锁，锁颗粒度大，比较重
>
> 连续模式 ：8.0版本之前为默认设置，该模式下可以保证同一 insert 语句中新插入的自增 ID 都是连续
>
> 混合模式 ：8.0版本默认设置，由于锁的粒度减少，多条语句在插入时进行锁竞争，自增长的值可能不连续。并且当 Binlog 模式为 statement（SBR）时， 直接导致主从之间同行的数据**主键 ID 不同**




### 1.4 自增 ID 分配问题

##### 1.4.1 自增 ID 的初始化

8.0版本之前，自增 ID 的值存储在内存中，重启后丢弃，下一次将读取内存预分配最大自增 ID之后的 ID 值进行发号

8.0版本之后，自增 ID 的值将会持久化到磁盘。每次发号时会写入 Redolog 日志，重启时通过 Redolog 恢复之前的值



##### 1.4.2 自增 ID 的连续性

三种模式都无法保障自增id的连续性，除非设置隔离界别为  串行化（Serialiable）隔离级别

i **插入发生唯一索引冲突校验**
  
  * 如已存数据(2, 清水)，name 字段是唯一键，再次插入(null, 清水), 唯一索引冲突校验，但这是自增ID已经变化为3，如再次插入(null, 水哥)，会使用4的自增 ID

ii **事务回滚**

  * 因为 id 是在内存中不持久化，如在同一事务中插入不提交事务，再回滚，会丢弃ID发号段，当再次执行插入语句，提交的的 id 不会连续，类似于产生幻读
  
  

##### 1.4.3 自增 ID 上限问题

如果表未设置主键，默认使用隐式的 ROW_ID 作为主键， 它的取值范围为 **[0, 2^32 -1]**

如果自增主键达到上限，则发放的下一个 ID 为最大 id 也就是4294967295 ，然后就会提示主键冲突。

>  Duplicate entry '4294967295' for key 'PRIMARY'

当然我们可以使用 bigint 类型，基本不会有这种问题

如果表设置主键，但主键类型是字符串，那么隐式的 ROW_ID 如果超过 4294967295 这个最大值，那么

新产生的数据行对应的 row_id 又会从 0 开始发放，此时新插入的数据行会覆盖 row_id=0 的数据记录



# 2 连续模式实践

###  2.1 简单插入

```mysql
CREATE TABLE user_test(
    id BIGINT(20) NOT NULL AUTO_INCREMENT,
	name VARCHAR(50) UNIQUE,
	age tinyint(3) DEFAULT 18,
	PRIMARY KEY(id),
	INDEX(name)
) ENGINE = INNODB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4
```

* <span id='jump'>唯一索引不冲突情况</span>
 ```sql
 insert into user_test(name) values("qinqshui"),("yunyan"),("heitie");
 select * from user_test;
 ```

结果如下

![sample-insert](/media/mysql-auto-inc/sample-insert.png)

简单插入情况下，插入的语句，可以提前预估插入的行数，所以连续的自增，是 1 2 3

* 唯一索引冲突情况

> ```mysql
  # 插入冲突冲突
  insert into user_test(name) values("qinqshui");
  # 插入不冲突记录
  insert into user_test(name) values("hanlin");
  select * from user_test;
 ```

结果如下

![unique-excp](/media/mysql-auto-inc/unique-excp.png)



有唯一性索引校验，但是后续的插入不是预期的 4 而是变成了 5 ，主键ID的连续性遭到破坏



### 2.2 批量插入

```sql
DROP TABLE user_test;
CREATE TABLE user_test(
    id BIGINT(20) NOT NULL AUTO_INCREMENT,
	name VARCHAR(50) UNIQUE,
	age tinyint(3) DEFAULT 18,
	PRIMARY KEY(id),
	INDEX(name)
) ENGINE = INNODB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4


CREATE TABLE student(
    name VARCHAR(40) UNIQUE
) ENGINE = INNODB; 
INSERT INTO student(name) VALUES ("zhang3"),("li4"), ("wang5"); 
# 批量插入 insert ... select
INSERT INTO user_test(name) SELECT name FROM student;

SELECT * FROM user_test;
```



批量插入结果如下

![batch-insert](/media/mysql-auto-inc/batch-insert.png)



在不能提前预估插入行数情况下，每插入一行，会获取一个自增 ID，无法提前发号段，导致在多个事务并发情况下，会出现同一事务自增ID不连续情况。



### 2.3 混合插入

```sql
DROP TABLE user_test;
CREATE TABLE user_test(
    id BIGINT(20) NOT NULL AUTO_INCREMENT,
	name VARCHAR(50) UNIQUE,
	age tinyint(3) DEFAULT 18,
	PRIMARY KEY(id),
	INDEX(name)
) ENGINE = INNODB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4

```



* ID 依次插入

```sql
insert into user_test(id, name) values(1, "qingshui");
# 混合插入
insert into user_test(id, name) values (50, "yunyan"),(NULL, "heitie"),(100, "hanlin"),(NULL,"tianqi");

SELECT * FROM user_test;
```

结果如下

![mix-insert](/media/mysql-auto-inc/mix-insert.png)



* 插入小于最大自增ID的情况

```sql
# 插入小于101的值
insert into user_test(id, name) values(2, "wushang");
# 再次使用主键
insert into user_test(id, name) values(null, "xiaojian");
SELECT * FROM user_test;
```

结果如下

![lt-insert](/media/mysql-auto-inc/lt-insert.png)





**混合插入**情况下，如果行指定了自增 ID，则不使用数据库生成新的 ID，但对应的最大自增 ID 会更新覆盖，如果未指定自增 ID，即 (NULL) 的情况下，数据库才会生成 ID，所以插入小于主键 ID 的情况，虽然插入的 ID 是2，但最大的自增 ID 更新至了102，后续插入变成 103



###  2.4 insert … on duplicate key update

接着上面的情况，继续执行以下语句：

```sql
# 一条更新，两条插入
insert into user_test(name)values("qingshui"),("longgu"),("renjie") on duplicate key update age=28;
select * from user_test;
```

结果如下

![on-dulicaptie](/media/mysql-auto-inc/on-dulicaptie.png)

一条更新的情况下，自增 ID 会+1但不使用，Id = 104 被占用，其他插入的情况会新增 ID 并使用，所以变成了 105 106





# 3 源码解析

阅读这部分源码前，需要了解Innodb锁系统的相关知识 [mysql 之 innodb 锁系统源码分析](https://nicky-chin.cn/2022/03/17/mysql-lock-struct/)



### 3.1 相关数据结构

* 表结构 **dict_table_t**

```c++
struct dict_table_t{
  // 表id
  table_id_t	id;	
  // 表名
  char*		name;
  // tablespace
  unsigned	space:32;
  // 表字段数组
  dict_col_t*	cols;
  // 表名称
  const char*	col_names;
  // 自增锁对象结构
  lock_t*		autoinc_lock;
  // 信号量互斥锁
  ib_mutex_t		autoinc_mutex;
  // 自增计数器
  ib_uint64_t	autoinc;d
  // 等待自增锁的事务
  ulong		n_waiting_or_granted_auto_inc_locks;
  // 当前持有自增表锁的事务
  const trx_t*	autoinc_trx;
  // 记录锁的数据 
  ulint		n_rec_locks;
};
```



* 事务结构体 

```c++
struct trx_t{
  // 事务锁信息和事务状态
  trx_lock_t	lock;
  // 隔离级别
  ulint	isolation_level;
  // 事务id
  trx_id_t	id;
  // readview
  read_view_t*	read_view;
  // 当前statement语句插入的行数
  ulint		n_autoinc_rows;
  // 持有的自增lock
  ib_vector_t*    autoinc_locks; 
}
```



* 号段缓存 **Discrete_interval** 

```c++
class Discrete_interval {
private:
  // 区间最小值（包含边界值）
  ulonglong interval_min;
  // 区间内可用自增id个数
  ulonglong interval_values;
  // 区间的最大值(不包含边界值)
  ulonglong  interval_max; 
  
  public:
  // 下一分配号段
  Discrete_interval *next; 
}
```




* 表句柄 **handler 和 ha_innobase**

```c++
// 默认表句柄
class handler :public Sql_alloc
{ public:
 
    // 下次插入的id
    ulonglong next_insert_id;
    // 当前插入的id
    ulonglong insert_id_for_cur_row;
    // 通过get_auto_increment()方法获取的预分配的发号段，缓存在server层，减少对innodb层的调用
    Discrete_interval auto_inc_interval_for_cur_row;
    // innodb预分配申请的发号段的步幅。按照[1, 2, 4, 8]指数递增，最大不能超过1<<16 -1
    // 可以通过handler::ha_release_auto_increment()方法重置
    uint auto_inc_intervals_count;

}

// innodb实现的表句柄
class ha_innobase: public handler
{
  // 预创建内存
  row_prebuilt_t*	prebuilt;
 
  // 主键id
    uint		primary_key;
  
}
// 预创建内存数据 cache
struc t row_prebuilt_t {
  // 表结构
  dict_table_t*	table;
  // 当前自增分配ID之后的下一待分配的ID
  ulonglong	autoinc_last_value;
  // id步幅，必须大于等于1			
  ulonglong	autoinc_increment;
  ulonglong	autoinc_offset;
  // 自增锁获取的错误信息，如获取成功为DB_SUCCESS
  dberr_t		autoinc_error;
}

```

handler 中使用的变量为 statement 语句级别，语句执行完毕，内存就释放清理，不会等待事务提交才进行释放



### 3.2 执行流程

##### 3.2.1 整体流程时序图

![mermaid-diagram-20220516102252](/media/mysql-auto-inc/mermaid-diagram-20220516102252.png)



* mutex 锁与自增锁

  > mutex锁 通过 dict_table_t 中的 ib_mutex_t 结构体实现，通过类似 *cas 比较并交换* 的方式实现加锁解锁，性能好
  >
  > 自增锁 依赖于锁系统的实现，属于表锁，性能差



#####  3.3.2 表自增 ID 的初始化

```c++
  // 如果包含自增主键则加mutex锁
  if (prebuilt->table != NULL
      && !prebuilt->table->ibd_file_missing
        && table->found_next_number_field != NULL) {
    dict_table_autoinc_lock(prebuilt->table);
    // 如果table未初始化自增值，则进行初始化
    if (dict_table_autoinc_read(prebuilt->table) == 0) {
        // 首次加载表获取自增ID初始值
      innobase_initialize_autoinc();
    }
    // 释放锁
    dict_table_autoinc_unlock(prebuilt->table);
  }

// 初始化自增ID
void ha_innobase::innobase_initialize_autoinc()
{
    ulonglong	auto_inc;
    const Field*	field = table->found_next_number_field;
    const char*	col_name;
    col_name = field->field_name;
    index = innobase_get_index(table->s->next_number_index);
    // 获取当前表的最大值
    /* Execute SELECT MAX(col_name) FROM TABLE; */
    err = row_search_max_autoinc(index, col_name, &read_auto_inc);
    switch (err) {
    case DB_SUCCESS: {
       ulonglong	col_max_value;
      // 如果表包含了自增列,获取自增列允许的最大值
      col_max_value = innobase_get_int_col_max_value(field);
      // 获取当前表的id最大值，步幅默认为1
      auto_inc = innobase_next_autoinc(
        read_auto_inc, 1, 1, 0, col_max_value);
      break;
     }
  dict_table_autoinc_initialize(prebuilt->table, auto_inc);
}
```


在执行插入语句的时候，对于同一张表，首次获取到 **mutex 锁**的语句会通过当前表执行 `SELECT MAX(col_name) FROM TABLE`获取最大自增 ID。加载到 `dict_table_t:: autoinc` 的属性中



#####  3.2.3简单插入和批量插入流程

* 测试语句 → [ 使用上述简单插入和批量插入的 SQL](#jump) 



插入流程如下

![insert-process](/media/mysql-auto-inc/insert-process.png)

* 简单插入 

  >  预估插入行数量 → 获取 mutex 锁 → 获取自增 ID 的号段 → 分配号段 → 释放 mutex

* 批量插入

  > 由于不确定插入行数，在语句执行期间，每插入一条数据都要重新获取一次自增锁

* 混合插入

```
例如上面实验的语句  insert into user_test(id, name) values (null, "yunyan"),(50, "heitie"),(null, "hanlin"),(100,"tianqi")
  
假设当前的自增值为20
  第一次调用 update_auto_increment，数据行是4条
  prebuilt->trx->n_autoinc_rows=4, Discrete_interval 号段如下
  {interval_min = 20, interval_values = 4, interval_max = 24, *next = NULL}
  
  发现第二行插入的50大于当前最大的号段值24，且 next 指针没有下一个预分配号段，则
  第二次调用 update_auto_increment，赋值成50
  prebuilt->trx->n_autoinc_rows=3
  
  第三次调用 update_auto_increment，数据行是2条
  prebuilt->trx->n_autoinc_rows=2
  {interval_min = 51, interval_values = 2, interval_max = 53, next = null}
  
  发现第四行插入的100大于当前最大的号段值53，且 next 指针没有下一个预分配号段，则
  第四次调用 update_auto_increment时，使用100
  prebuilt->trx->n_autoinc_rows=1

上述这种实验 SQL，最多可以加四次 mutex 锁，具体要看预分配号段的策略
```



* **update_auto_increment** 流程

```c++
int handler::update_auto_increment()
{
   // 判断自增列是否已经赋值，或者 是否不为NULL并且sql_mode为MODE_NO_AUTO_VALUE_ON_ZERO时，不做处理
  if ((nr= table->next_number_field->val_int()) != 0 ||
      (table->auto_increment_field_not_null &&
      thd->variables.sql_mode & MODE_NO_AUTO_VALUE_ON_ZERO))
  {
    // 根据nr和offset设置下一个自增值next_insert_id
    adjust_next_insert_id_after_explicit_value(nr);
    insert_id_for_cur_row= 0; 
    DBUG_RETURN(0);
  }
  // 当预分配的自增ID区间用完时，需要取更多的insert id。
  if ((nr= next_insert_id) >= auto_inc_interval_for_cur_row.maximum())
  {
    const Discrete_interval *forced=
      thd->auto_inc_intervals_forced.get_next();
    // 如果预分配了下一区间，则使用下一个区间的数据
    if (forced != NULL)
    {
      nr= forced->minimum();
      nb_reserved_values= forced->values();
    }
     // 获取自增id
     get_auto_increment(variables->auto_increment_offset,
                         variables->auto_increment_increment,
                         nb_desired_values, &nr,
                         &nb_reserved_values);
  if (append)
   { // 更新 Discrete_interval
    auto_inc_interval_for_cur_row.replace();
  // 设置当前事务中下一个要处理的行的自增列的值至handler中
  set_next_insert_id(compute_next_insert_id(nr, variables));
   }
```



* 设置自增 ID **get_auto_increment**

```c++
void ha_innobase::get_auto_increment()
{
  trx_t*		trx;
  dberr_t		error;
  ulonglong	autoinc = 0;

  // 获取锁
  error = innobase_get_autoinc(&autoinc);
  if (error != DB_SUCCESS) {
    *first_value = (~(ulonglong) 0);
    return;
  }
  // 是否是还计算插入行数的语句
  if (trx->n_autoinc_rows == 0) {
    trx->n_autoinc_rows = (ulint) nb_desired_values;
    set_if_bigger(*first_value, autoinc);
  } 
  *nb_reserved_values = trx->n_autoinc_rows;
  // 非传统模式处理
  if (innobase_autoinc_lock_mode != AUTOINC_OLD_STYLE_LOCKING) {
    ulonglong	current;
    ulonglong	next_value;
    // 自增id不能超过自增字段长度最大值
    current = *first_value > col_max_value ? autoinc : *first_value;
    // 计算下一次分配的自增ID值
    next_value = innobase_next_autoinc(
      current, *nb_reserved_values, increment, offset,
      col_max_value);
    prebuilt->autoinc_last_value = next_value;
    if (prebuilt->autoinc_last_value < *first_value) {
      *first_value = (~(ulonglong) 0);
    } else {
      // 更新dict_table_t的下一个分配id
      dict_table_autoinc_update_if_greater(
        prebuilt->table, prebuilt->autoinc_last_value);
    }
  prebuilt->autoinc_increment = increment;
  // 释放mutex锁
  dict_table_autoinc_unlock(prebuilt->table);
}
```

主要流程是先获取锁，然后校验分配的 id 也就是对应的` first_value`值是否小于字段最大值，并更新到当前语句中的 prebuilt 内存中和全局的 dict_table_t 表中



*  获取锁流程 **innobase_get_autoinc**

```c++
ha_innobase::innobase_lock_autoinc(void){
  dberr_t		error = DB_SUCCESS;
  // 判断自增锁模式
  switch (innobase_autoinc_lock_mode) {
   // 交叉模式使用mutex锁   
  case AUTOINC_NO_LOCKING: 
    dict_table_autoinc_lock(prebuilt->table);
    break;
  // 连续模式
  case AUTOINC_NEW_STYLE_LOCKING:
    // 单条确定insert影响的条数的时候，使用mutex。
    if (thd_sql_command(user_thd) == SQLCOM_INSERT
        || thd_sql_command(user_thd) == SQLCOM_REPLACE) {
      dict_table_t*	ib_table = prebuilt->table;
      /* Acquire the AUTOINC mutex. */
      dict_table_autoinc_lock(ib_table);
      // 判断是否有其他事务已获取或在等待autoinc Lock，
      // 如果存在，解除Mutex并回退到AUTOINC_OLD_STYLE_LOCKING，否则break
      if (ib_table->n_waiting_or_granted_auto_inc_locks) {
        /* Release the mutex to avoid deadlocks. */
        dict_table_autoinc_unlock(ib_table);
      } else {
        break;
      }
    }
  // 如果是insert select，load data这样的语句，则升级为传统模式
  case AUTOINC_OLD_STYLE_LOCKING:
    // 尝试加排他的自增锁
    error = row_lock_table_autoinc_for_mysql(prebuilt);
    if (error == DB_SUCCESS) {
      /* Acquire the AUTOINC mutex. */
      //再次拿到mutex 
      dict_table_autoinc_lock(prebuilt->table);
    }
    break;
  default:
    ut_error;
  }
  return(error);
}
```

除了锁模式设置为*传统模式或者是无法语句行数的批量插入使用表锁外*，其余都是用轻量级的 mutex 锁



*  **insert … on duplicate key update**

会调用 `ha_innobase::update_row`方法

```c++
  // 获取自增ID成功&是插入语句 & duplicates的情况下
  if (error == DB_SUCCESS
      && table->next_number_field
      && new_row == table->record[0]
      && thd_sql_command(user_thd) == SQLCOM_INSERT
      && trx->duplicates)  {
    ulonglong	auto_inc;
    ulonglong	col_max_value;

    auto_inc = table->next_number_field->val_int();
    // 获取最大值
    col_max_value = innobase_get_int_col_max_value(
      table->next_number_field);
    // 如果自增ID小于最大值
    if (auto_inc <= col_max_value && auto_inc != 0) {
      ulonglong	offset;
      ulonglong	increment;
      offset = prebuilt->autoinc_offset;
      increment = prebuilt->autoinc_increment;
      // 设置下一个自增ID
      auto_inc = innobase_next_autoinc(auto_inc, 1, increment, offset, col_max_value);
      // 更新dict_table_t的自增ID值
      error = innobase_set_max_autoinc(auto_inc);
      }
	}
```

对于`INSERT INTO t (c1,c2) VALUES(x,y) ON DUPLICATE KEY UPDATE`语句，无论唯一索引列所指向的行是否存在，都会更新表的 auto increment 值



# 4 自增 ID 产生的问题



实际业务中，会使用 ID 返回给客户端，或者通过类似 teacher_info?id=? 的 API 接口获取信息，这样不仅会暴露数据量，同时也会更加容易遭遇爬虫的情况，所以可以参考下面方式优化

* ID 混淆

  原始数据 xor 随机数 + 校验位，校验位使用 luhn 算法，占用1位数字，仅用于安全级别不高的整型数据混淆，优点是处理速度快，处理结果依然是整型

* [雪花算法](https://nicky-chin.cn/tags/%E5%88%86%E5%B8%83%E5%BC%8Fid%E6%96%B9%E6%A1%88/)
 
 基于时间戳生成，趋势递增，满足范围查询和时间排序，但需保证发号器服务高可用，同时需考虑时钟回拨与时钟同步问题


* 映射法
 
 维护 ID 与 hash 的映射关系，可以基于 Redis 组件实现，常见的实现方式比如: 短链接服务



# 5 reference

[官方文档-innodb-auto-increment-lock-modes](https://dev.mysql.com/doc/refman/5.6/en/innodb-auto-increment-handling.html#innodb-auto-increment-lock-modes)

[innodb之mutex的实现](https://blog.csdn.net/yuanrxdu/article/details/41170381)

[关于 MySQL 自增 ID 的事儿](https://mp.weixin.qq.com/s/7HKNkpBuPotJ9bcAOCSA6w)