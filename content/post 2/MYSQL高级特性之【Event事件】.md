

---
title: MYSQL高级特性之【Event事件】
date: 2018-04-28T11:18:15+08:00
weight: 70
slug: high-event
tags: ["基础"]
categories: ["MySql"]
author: "nicky_chin"
comments: true
share: true
draft: false
---


**一、基本概念** mysql5.1版本开始引进event概念。event既“时间触发器”，与triggers的事件触发不同，event类似与linux crontab计划任务，用于时间触发。通过单独或调用存储过程使用，在某一特定的时间点，触发相关的SQL语句或存储过程。

**二、适用范围** 对于每隔一段时间就有固定需求的操作，如创建表，删除数据等操作，可以使用event来处理。

例如：使用event在每月的1日凌晨1点自动创建下个月需要使用的三张表。

  每天清除数据表中的过期的记录。

**三、使用权限** 单独使用event调用SQL语句时，查看和创建需要用户具有event权限，调用该SQL语句时，需要用户具有执行该SQL的权限。Event权限的设置保存在mysql.user表和mysql.db表的Event_priv字段中。

当event和procedure（存储过程）配合使用的时候，查看和创建存储过程需要用户具有create routine权限，调用存储过程执行时需要使用excute权限，存储过程调用具体的SQL语句时，需要用户具有执行该SQL的权限。
查看EVENT命令有如下几种：
>（1）查询mysql.event表；
（2）通过SHOW EVENTS命令；
（3）通过SHOW FULL EVENTS命令；
（4）通过查询information_schema.events表
（5）SHOW CREATE EVENT。  
   总之，event的使用频率较低建议使用root用户进行创建和维护。

**四、基本语法**

**4.1 开启定时器** 要使event起作用，MySQL的常量GLOBAL event_scheduler必须为on或者是1
-- 查看是否开启定时器

```
SHOW VARIABLES LIKE 'event_scheduler';
```
-- 开启定时器 0：off 1：on 

```
SET GLOBAL event_scheduler = 1; 
```
当你设定事件计划为0 或OFF，即关闭事件计划进程的时候，不会有新的事件执行，但现有的正在运行的事件会执行到完毕

对于我们线上环境来说，使用event时，注意在主库上开启定时器，从库上关闭定时器，event触发所有操作均会记录binlog进行主从同步，从库上开启定时器很可能造成卡库。切换主库后之后记得将新主库上的定时器打开。

请特别注意！

**4.2 创建事件** CREATE EVENT 的语法如下：
```
CREATE EVENT
[IF NOT EXISTS] ---------------------------------------------*标注1
event_name -----------------------------------------------------*标注2
ON SCHEDULE schedule ------------------------------------*标注3 
[ON COMPLETION [NOT] PRESERVE] -----------------*标注4
[ENABLE | DISABLE] ----------------------------------------*标注5 
[COMMENT 'comment'] --------------------------------------*标注6 
DO sql_statement -----------------------------------------------*标注7
```
**说明：**  
**标注1：[IF NOT EXISTS]**
使用IF NOT EXISTS，只有在同名event不存在时才创建，否则忽略。建议不使用以保证event创建成功。

**标注2：event_name**  
名称最大长度可以是64个字节。名字必须是当前Dateabase中唯一的，同一个数据库不能有同名的event。使用event常见的工作是创建表、插入数据、删除数据、清空表、删除表。

为了避免命名规范带来的不便，最好让事件名称具有描述整个事件的能力。建议命名规则如下为：动作名称_（INTO/FROM_）表名_TIME，例如：
```
1.  每月创建（清空/删除）fans表：  
create(truncate/drop)_table_fans_month；
2.  每天从fans表插入（删除）数据： 
insert(delete)_into(from)_fans_day；
```
**标注3**：**ON SCHEDULE**  
**ON SCHEDULE 计划任务，有两种设定计划任务的方式：**  
1\. AT 时间戳，用来完成单次的计划任务。

2\. EVERY 时间（单位）的数量时间单位[STARTS 时间戳] [ENDS时间戳]，用来完成重复的计划任务。

在两种计划任务中，时间戳可以是任意的TIMESTAMP 和DATETIME 数据类型，时间戳需要大于当前时间。

在重复的计划任务中，时间（单位）的数量可以是任意非空（Not Null）的整数式，时间单位是关键词：YEAR，MONTH，DAY，HOUR，MINUTE 或者SECOND。

提示: 其他的时间单位也是合法的如：QUARTER, WEEK, YEAR_MONTH,DAY_HOUR,DAY_MINUTE,DAY_SECOND,HOUR_MINUTE,HOUR_SECOND, MINUTE_SECOND，不建议使用这些不标准的时间单位。

**标注4**： [**ON COMPLETION [NOT] PRESERVE**] 
ON COMPLETION参数表示"当这个事件不会再发生的时候"，即当单次计划任务执行完毕后或当重复性的计划任务执行到了ENDS阶段。而PRESERVE的作用是使事件在执行完毕后不会被Drop掉，建议使用该参数，以便于查看EVENT具体信息。

**标注5：[ENABLE | DISABLE]**
参数Enable和Disable表示设定事件的状态。Enable表示系统将执行这个事件。Disable表示系统不执行该事件。
可以用如下命令关闭或开启事件：
```
ALTER EVENT event_name  ENABLE/DISABLE
```
**标注6**：[**COMMENT 'comment'**]  
注释会出现在元数据中，它存储在information_schema表的COMMENT列，最大长度为64个字节。'comment'表示将注释内容放在单引号之间，建议使用注释以表达更全面的信息。

**标注 7**: **DO sql_statement** 
DO sql_statement字段表示该event需要执行的SQL语句或存储过程。这里的SQL语句可以是复合语句，例如：
```
BEGIN
CREATE TABLE test1;//创建表（需要测试一下）
DROP TABLE test2;//删除表
CALL proc_test1();//调用存储过程
END
```
使用BEGIN和END标识符将复合SQL语句按照执行顺序放在之间。当然SQL语句是有限制的，对它的限制跟函数Function和触发器Trigger 中对SQL语句的限制是一样的，如果你在函数Function 和触发器Trigger 中不能使用某些SQL，同样的在EVENT中也不能使用。明确的来说有下面几个：
```
LOCK TABLES
UNLOCK TABLES
CREATE EVENT
ALTER EVENT
LOAD DATA
```
**4.3  执行逻辑** For (已建立事件each event that has been created)
```
If (事件的状态非DISABLE)
And (当前时间在ENDS时间之前)
And (当前时间在STARTS时间之后)
And (在上次执行后经过的时间)
And (没有被执行)
Then:
建立一个新的线程
传递事件的SQL语句给新的线程
(该线程在执行完毕后会自动关闭)
```
**4.4 修改事件** 使用ALTER EVENT 来修改事件，具体的ALTER语法如下，与创建事件的语法类似：
```
ALTER EVENT
event_name

ON SCHEDULE schedule
[RENAME TO new_event_name]
[ON COMPLETION [NOT] PRESERVE]
[ENABLE | DISABLE]
[COMMENT 'comment']
DO sql_statement
```
**4.5 删除事件** EVENT使用DROP EVENT语句来删除已经创建的事件，语法如下：
```
DROP EVENT
[IF EXISTS]
event_name
```
但当一个事件正在运行中时，删除该事件不会导致事件停止，事件会执行到完毕为止。使用DROP USER和DROP DATABASE 语句同时会将包含其中的事件删除。

**五、常用实例** 每隔一秒自动调用e_test()存储过程

```
CREATE EVENT IF NOT EXISTS e_test
ON SCHEDULE EVERY 1 SECOND
ON COMPLETION PRESERVE
DO CALL e_test();
```
每个月的一号凌晨1 点执行STAT()存储过程：

```
CREATE  EVENT  NOT EXISTS  STAT
ON  SCHEDULE  EVERY  1  MONTH  STARTS DATE_ADD(DATE_ADD(DATE_SUB(CURDATE(),INTERVAL DAY(CURDATE())-1 DAY), INTERVAL 1 MONTH),INTERVAL 1 HOUR)
ON  COMPLETION  PRESERVE  ENABLE
DO
BEGIN
CALL STAT();
END
```
每天0点05分从数据表中清除字段（yhendtime）小于当前时间戳的记录：

```
CREATE EVENT `dele_from_thinkyh` 
ON SCHEDULE EVERY 1 DAY STARTS '2016-12-30 00:05:00' 
ON COMPLETION PRESERVE ENABLE COMMENT '每天清除数据表think_youhui中的过期的记录' 
DO DELETE FROM `think_youhui` WHERE `think_youhui`.`yhendtime`<CURRENT_DATE
```
