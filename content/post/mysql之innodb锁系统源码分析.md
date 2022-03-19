---
title: mysql之innodb锁系统源码分析
date: 2022-03-17T11:14:15+08:00
weight: 70
slug: mysql-lock-struct
tags: ["源码"]
categories: ["MySql"]
author: "nicky_chin"
comments: true
share: true
draft: false
---

# mysql之innodb锁系统源码分析


# 1 锁系统

在 mysql 中 innodb 是常用的存储引擎，我们经常会遇到慢 sql 或者死锁，所以深入了解 DDL 和 DML 语句下锁机制是非常有必要的。

innoDB 存储引擎的锁，按不同的维度可以进行不同的划分:

按照锁粒度划分可以分为：表锁和行锁

按照锁兼容性划可以分为：共享锁和排他锁

### 1.1 锁模式

#### 1.1 意向锁

######  i 意向共享锁(LOCK_IS)

* 表级锁，如需要在对应的记录行加共享锁时，必须先获取其对应表下对应的意向共享锁或者锁强度更高的表级锁

######  ii  意向排他锁(LOCK_IX)

* 表级锁，如需要在对应的记录行加排他锁时，必须先获取其对应表下对应的意向排他锁或者锁强度更高的表级锁

常见的加意向锁，比如 `SELECT ... FOR SHARE` 会在对应记录行上加锁之前会先加表级意向共享锁，而 `SELECT .. FOR UPDATE` 则先加表级意向排他锁。

####  1.2 共享锁(LOCK_S)

共享锁的作用主要用于在事务中读取行记录后，不希望数据行不被其他的事务锁修改，但所有的读操作产生的 LOCK_S 锁不冲突的，来提高读读并发能力，常见的如 

> SELECT … IN SHARE MODE

> 普通查询在隔离级别为 SERIALIZABLE 会给记录加 LOCK_S 锁

> 对于普通的 INSERT/UPDATE，检查到 `duplicate key`（或者有一个被标记删除的 duplicate key ）, 会加 LOCK_S 锁



####  1.3 排他锁(LOCK_X)

排他锁主要是为了避免对相同记录的并发修改控。其中常用的 UPDATE 或者 DELETE 操作，以及 `SELECT … FOR UPDATE` 操作，都会对记录加排他锁。只有拥有该锁的事务可以读取和修改数据行，其他事务进入阻塞状态，该锁是独占的，同一时间对于同一数据行只有一个事务可以拥有排他锁



####  1.4 自增锁(LOCK_AUTO_INC)

当插入的表中有自增列（AUTO_INCREMENT）的时候会触发自增锁。当插入表中有自增列时，数据库需要自动生成自增id，在生成之前会先为该表加 `AUTO_INC` 表锁，其他事务的插入操作阻塞，这样保证生成的自增值肯定是唯一的。`AUTO_INC` 的加锁逻辑和 innoDB 的锁模式相关，自增锁模式通过参数 `innodb_autoinc_lock_mode` 来控制

  


###  1.2 行锁类型

行锁作用在聚簇索引和二级索引上，通过不同隔离级别的加锁方式来避免脏读，幻读



####  1.2.1 记录锁(LOCK_REC_NOT_GAP)

记录锁属于行锁，它主要目的是为了锁住当前数据库的记录行，在 RC 和 RR 隔离级别下会使用到记录锁



####  1.2.2 间隙锁 (LOCK_GAP)

[**间隙锁**](https://dev.mysql.com/doc/refman/5.7/en/innodb-locking.html#innodb-gap-locks) 是一种加在索引记录范围的锁，主要为了锁住某个范围区间而不锁记录本身，可以理解为一种区间锁，一般在RR隔离级别下会使用到 GAP 锁。如不想使用间隙锁，可以通过切换到 RC 隔离级别，或者开启选项 `innodb_locks_unsafe_for_binlog `来避免 GAP 锁



####  1.2.3 临键锁(LOCK_ORDINARY)

临键锁记录锁和间隙锁的组合。在 MySQL RR 的隔离级别下 `NEXT-KEY LOCK` 可以解决 RR 隔离级别下的幻读问题。所谓幻读就是在同一事务内执行相同的查询，会查询到不同的行记录。但在 RR 隔离界别下，不会发生，比如索引包含100、101 和 230 这几个值，那么在RR级别下存在的临键锁如下：

- (-∞, 100]
- (100, 101]
- (101, 230]
- (230, +∞)



#### 1.2.4 插入意向锁(LOCK_INSERT_INTENTION)

INSERT INTENTION 锁是 GAP 锁的一种，主要为了提高插入并发和避免幻读异常问题，如果有多个事务插入同一个 GAP 时，他们无需互相等待，例如当前索引上有记录5和11，两个并发事务同时插入记录4，6。他们会分别为(5,11)加上 GAP 锁，但相互之间并不冲突（因为插入的记录不冲突）



# 2 源码实现



锁相关结构总体概览如下图:

![img](/media/mysql-lock-struct/锁结构.png)

#### 2.1 锁系统

```c++
/**
 * 锁系统结构
 */
struct lock_sys_t{
  // 互斥锁
  ib_mutex_t	mutex;
  // 记录锁hash表 哈希的key是由记录锁的spaceid和page no形成，value为lock_t
  hash_table_t*	rec_hash;
  ib_mutex_t	wait_mutex;	
  // 等待锁挂起的线程
  srv_slot_t*	waiting_threads;
  ibool		rollback_complete;
  // 锁最大等待时间
  ulint		n_lock_max_wait_time;
  os_event_t	timeout_event;
  // 是否有活跃的超时线程
  bool		timeout_thread_active;
};
```

- 主要成员变量是一个 `hash table`，用于管理全局活跃事务创建的锁对象



#### 2.2 锁结构

```c++
/**
 * 锁对象结构
 */
struct lock_t {
  // 拥有该锁的事务
  trx_t*		trx;
  // 该事务持有的锁链表
  UT_LIST_NODE_T(lock_t) trx_locks;
  // 锁模式和类型  lock_type | type_mode
  ulint		type_mode;
  // 记录锁hash链节点
  hash_node_t	hash;
  
  // 记录锁索引
  dict_index_t*	index;
  // 锁信息采用union方式管理，节省空间
  union {
    // 表锁
    lock_table_t	tab_lock;
    // 行锁
    lock_rec_t	rec_lock;
  } un_member;
  };
```

* 属性变量 hash:  当锁插入到 `lock_sys->hash` 中，hash 值相同就形成链表，使用变量 hash 相连。

* type_mode: 锁模式和类型

###### 锁模式 

```c++
/**
 * 锁模式
 */
enum lock_mode {
    // S意向锁
  LOCK_IS = 0,
  // X意向锁
  LOCK_IX,
  // S共享锁
  LOCK_S,
  // X独占锁
  LOCK_X,	  
  // 自增锁
  LOCK_AUTO_INC
  };
```



###### 锁类型

```c++
// 锁模式mask码
#define LOCK_MODE_MASK	0xFUL
// 表锁 第5位大小16
#define LOCK_TABLE	16
// 行锁 第6位大小32
#define	LOCK_REC	32
// 锁类型mask码
#define LOCK_TYPE_MASK	0xF0UL
// 锁等待标识
#define LOCK_WAIT	256

// 行锁模式类型
//  表示 next-key lock临键锁 ，锁住记录本身和对应的间隙
#define LOCK_ORDINARY	0
// 表示锁住记录之前 gap（不锁记录本身）
#define LOCK_GAP	512
// 记录锁
#define LOCK_REC_NOT_GAP 1024
// 插入意向锁
#define LOCK_INSERT_INTENTION 2048
// 表示锁是由其它事务创建的(比如隐式锁转换)
#define LOCK_CONV_BY_OTHER 4096 
```



innodb 使用32位整型字段 `uint32_t lock_t::type_mode`，具体存储方式如下图: 

![img](/media/mysql-lock-struct/锁模式.png)



>  0-3位表示锁模式，包括意向共享锁、意向排它锁、共享锁、排它锁还是自增锁

>  4位表示锁是表类型，1代表是表锁，0代表不是

>  8位表示是否锁等待

>  9到31位表示是记录锁类型



在 c++ 代码实现上，不同模式的锁表示方法如下表所示

| 锁模式(type_mode) | 锁表示法                                    |
| :---------------: | :------------------------------------------ |
|      记录锁       | LOCK_X \| LOCK_REC_NO_GAP                   |
|      间隙锁       | LOCK_X \| LOCK_GAP                          |
|      临键锁       | LOCK_X \| LOCK_ORDINARY                     |
|    插入意向锁     | LOCK_X \| LOCK_GAP \| LOCK_INSERT_INTENTION |



###### 锁类型判断

```c++
    switch (lock_get_type_low(lock)) {
      // 表锁
      case LOCK_TABLE:
      iter->bit_no = ULINT_UNDEFINED;
      break;
      // 记录锁
      case LOCK_REC:
      iter->bit_no = lock_rec_find_set_bit(lock);
      ut_a(iter->bit_no != ULINT_UNDEFINED);
      break;
      default:
      ut_error;
    }

    /**
    * 获取锁类型
    */
    ulint lock_get_type_low(const lock_t*	lock)
    {
      ut_ad(lock);
      return(lock->type_mode & LOCK_TYPE_MASK);
    }
```

lock_type 现在只使用了第5位和第6位，表示表锁还是行锁



###### 锁模式判断

```c++
enum lock_mode lock_get_mode(
  const lock_t*	lock){
  ut_ad(lock);
  return(static_cast<enum lock_mode>(lock->type_mode & LOCK_MODE_MASK));
}
```



###### 记录锁类型判断

```c++
// 间隙锁判断
ulint lock_rec_get_gap(const lock_t*	lock){
  ut_ad(lock);
  ut_ad(lock_get_type_low(lock) == LOCK_REC);
  return(lock->type_mode & LOCK_GAP);
}
// 记录锁判断
ulint lock_rec_get_rec_not_gap(const lock_t*	lock)
{
  ut_ad(lock);
  ut_ad(lock_get_type_low(lock) == LOCK_REC);
  return(lock->type_mode & LOCK_REC_NOT_GAP);
}
// 插入意向锁判断
ulint lock_rec_get_insert_intention(const lock_t*	lock)	
{
  ut_ad(lock);
  ut_ad(lock_get_type_low(lock) == LOCK_REC);
  return(lock->type_mode & LOCK_INSERT_INTENTION);
}
```



`un_member` 成员变量表示` lock_t` 不是表锁就是行锁

```c++
/**
 * 表锁结构
 */
/** A table lock */
struct lock_table_t {
  // 数据库表结构
  dict_table_t*	table;
  // 数据库同一表上的锁
  UT_LIST_NODE_T(lock_t)locks;
};

/**
 * 行锁结构
 */
struct lock_rec_t {
  // 表空间table space的id
  ulint	space;
  // 对应的page页号
  ulint	page_no;
  // 位图结构用于确定page中记录行有锁的数据位数
  ulint	n_bits;
};
```

[space, page_no] 可以确定锁对应哪个 page 页，page 页上使用 heap_no 来表示是第几行数据。通过[space, page_no, heap_no]可以唯一确定一行。innodb 使用 n_bits 位图来表示锁具体锁住了哪几行

> 表锁和记录锁共用数据结构 lock_t

> 行锁以 page 为单位进行管理，同一事务在同一个 page 页上只创建一个 lock_t 对象，通过记录在 page 中唯一标识的 heap no 到 bitmap 查询该位是否为1确定是否该记录行上锁


#### 2.3 锁兼容性和锁强度

* 加锁强度矩阵

```c++
/* STRONGER-OR-EQUAL RELATION (mode1=row, mode2=column)
 *    IS IX S  X  AI
 * IS +  -  -  -  -
 * IX +  +  -  -  -
 * S  +  -  +  -  -
 * X  +  +  +  +  +
 * AI -  -  -  -  +
 * See lock_mode_stronger_or_eq().
 */
static const byte lock_strength_matrix[5][5] = {
 /**         IS     IX       S     X       AI */
 /* IS */ {  TRUE,  FALSE, FALSE,  FALSE, FALSE},
 /* IX */ {  TRUE,  TRUE,  FALSE, FALSE,  FALSE},
 /* S  */ {  TRUE,  FALSE, TRUE,  FALSE,  FALSE},
 /* X  */ {  TRUE,  TRUE,  TRUE,  TRUE,   TRUE},
 /* AI */ {  FALSE, FALSE, FALSE, FALSE,  TRUE}
};
```

加锁时候，首先判断当前事务上是否已经加了同等级或者更强级别的锁，就比如加了 LOCK_X 就不必要加 LOCK_S 了

* 锁互斥矩阵

```c++
/* LOCK COMPATIBILITY MATRIX
 *    IS IX S  X  AI
 * IS +	 +  +  -  +
 * IX +	 +  -  -  +
 * S  +	 -  +  -  -
 * X  -	 -  -  -  -
 * AI +	 +  -  -  -
 *
 * Note that for rows, InnoDB only acquires S or X locks.
 * For tables, InnoDB normally acquires IS or IX locks.
 * S or X table locks are only acquired for LOCK TABLES.
 * Auto-increment (AI) locks are needed because of
 * statement-level MySQL binlog.
 * See also lock_mode_compatible().
 */
static const byte lock_compatibility_matrix[5][5] = {
 /**         IS     IX       S     X       AI */
 /* IS */ {  TRUE,  TRUE,  TRUE,  FALSE,  TRUE},
 /* IX */ {  TRUE,  TRUE,  FALSE, FALSE,  TRUE},
 /* S  */ {  TRUE,  FALSE, TRUE,  FALSE,  FALSE},
 /* X  */ {  FALSE, FALSE, FALSE, FALSE,  FALSE},
 /* AI */ {  TRUE,  TRUE,  FALSE, FALSE,  FALSE}
};
```



加锁过程中，如果锁和当前锁是相同的事务，返回 false 不需要等待。如果锁和当前锁的基本锁类型兼容不需要等待，否则会进入锁等待



# 3 参考

[官方文档 InnoDB Locking](https://dev.mysql.com/doc/refman/5.6/en/innodb-locking.html)

[InnoDB 事务锁系统简介](https://www.bookstack.cn/read/aliyun-rds-core/4adfb6141be60032.md#9zcjpa)
