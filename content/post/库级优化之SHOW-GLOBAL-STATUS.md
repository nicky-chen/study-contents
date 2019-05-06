Title: 库级优化之SHOW GLOBAL STATUS
Date: 2018-05-10 18:11
Tags: 库级优化
Category: MySql
Slug: SHOW-GLOBAL-STATUS


**慢查询**
```
//查询慢线程情况
show global status like '%slow%'

+---------------------+-------+     
| Variable_name       | Value |     
+---------------------+-------+     
| Slow_launch_threads | 1     |     
| Slow_queries        | 100   |     
+---------------------+-------+   

如果Slow_launch_threads值较大，说明有些东西正在延迟连接的新线程

//查询慢查询日志是否开启
show variables like '%slow%'

+---------------------+--------------------------------------+
| Variable_name       | Value                                |
+---------------------+--------------------------------------+
|log_slow_admin_statements|    ON                            |
|log_slow_slave_statements|     OFF                          |
| slow_launch_time    | 2                                    |
| slow_query_log      | ON                                   |
| slow_query_log_file |     /home/mysql/mysql/slow_query.log |
+---------------------+--------------------------------------+

log_slow_admin_statements表示是否将慢管理语句例如ANALYZE TABLE和ALTER TABLE等记入慢查询日志
 log_slow_slave_statements 表示是否管理分区慢查询记录，一般不会去选择分区，所以不考虑
```
配置中一定要开启慢查询，这对服务器性能损耗并不大，如上面的打印结果得知：超过2秒即为慢查询，一共有100条慢查询 。当然我们在后台也可以做sql拦截记录，定制化慢查询语句。通常，可以通过mybatis插件拦截耗时sql打印日志

**连接数** 

```
//mysql的最大连接数
show global status like 'max_connections';

+-----------------+-------+  
| Variable_name   | Value |  
+-----------------+-------+  
| max_connections | 500   |  
+-----------------+-------+  

常见的问题"MYSQL: ERROR 1040: Too many connections"的异常情况，造成这种情况的一种原因是用户访问量过高,
MySQL服务器抗不住也有可能是最大连接数设置的过小，需要注意

//服务器响应的最大连接数
show global status like 'max_used_connections';  
+----------------------+-------+  
| Variable_name        | Value |  
+----------------------+-------+  
| Max_used_connections | 450   |  
+----------------------+-------+  
```
设置的最大连接数是500，而响应的连接数是498，max_used_connections / max_connections * 100% = 90% （理想值 ≈ 85%）。  
当前响应数占比太小也不好，说明利用率不高。 比较理想的是在10%以上，不长期徘徊在10%以下，说明最大链接数量设置过高


**索引缓冲区的大小 key_buffer_size（MyISAM）**
```
show global status like 'key_read%';     
+-------------------+----------+     
| Variable_name     | Value    |     
+-------------------+----------+     
| Key_read_requests | 600 |     
| Key_reads         | 60    |     
+-------------------+----------+    

通过检查状态值Key_read_requests和Key_reads，可以知道key_buffer_size设置是否合理。
比例key_reads /key_read_requests应该尽可能的低，至少是1:100，1:1000更好
key_buffer_size只对MyISAM表起作用
  
mysql> show variables like 'key_buffer_size';  
+-----------------+----------+  
| Variable_name   | Value    |  
+-----------------+----------+  
| key_buffer_size | 16777216 |  
+-----------------+----------+  
  
一共有600个索引读取请求，有60个请求在内存中没有找到直接从硬盘读取索引，计算索引未命中缓存的概率：   
key_cache_miss_rate ＝ Key_reads / Key_read_requests * 100% =0.27%   
需要适当加大key_buffer_size   
```

**open table 的情况**

```
如果查询非常满，并且通过show processlist 发现state一栏中比较多的查询正在opening table，那么可以使用接下来的命令优化

mysql> show global status like 'open%tables%';     
+---------------+-------+     
| Variable_name | Value |     
+---------------+-------+     
| Open_tables   | 299   |     
| Opened_tables | 33000 |     
+---------------+-------+    
 
Open_tables 表示打开表的数量，Opened_tables表示打开过的表数量，如果Opened_tables数量过大，
说明配置中 table_cache值可能太小，我们查询一下服务器table_open_cache值   

mysql> show variables like '%open_%';  
+---------------+-------+ ------+------+    
| Variable_name                | Value |  
+---------------+-------+------+ ------+    
|innodb_open_files             | 3000  |  
|open_files_limit              | 65535   |  
|table_open_cache              | 200   |  
| table_open_cache_instances   | 16    |  
+---------------+-------+------+------+      
  
比较理想的值：
Open_tables / Opened_tables >= 0.85
Open_tables / table_open_cache <= 0.95

table_open_cache_instances：表缓存实例数，为通过减小会话间争用提高扩展性，表缓存会分区为table_open_cache/table_open_cache_instances大小的较小的缓存实例。DML语句会话只需要锁定所在缓存实例，
这样多个会话访问表缓存时就可提升性能（DDL语句仍会锁定整个缓存）。默认该值为1，当16核以上可设置为8或16。

```


**进程使用情况**

```
mysql> show global status like 'Thread%';  
+-------------------+-------+  
| Variable_name     | Value |  
+-------------------+-------+  
| Threads_cached    | 31    |  
| Threads_connected | 239   |  
| Threads_created   | 2914  |  
| Threads_running   | 4     |  
+-------------------+-------+  
Threads_connected 表示当前连接数。Threads_running是代表当前并发数

Threads_running有如下可能
1. 某个DML线程阻塞到了其他select 进程，导致堆积。
2. 缓存失效，某个缓存对象在某个时间点统一失效，导致各台web服务器同时并发进行数据库访问。

Threads_created表示创建过的线程数，如果发现Threads_created值过大的话，表明 MySQL服务器一直在创建线程，这也是比较耗资源，
可以适当增加配置文件中thread_cache_size值，查询服务器 thread_cache_size配置：   
  
mysql> show variables like 'thread_cache_size';     
+-------------------+-------+     
| Variable_name     | Value |     
+-------------------+-------+     
| thread_cache_size | 32    |     
+-------------------+-------+    

 连接池配置建议： thread_cache_size =  8 + (max_connections / 100)
```


**锁情况**    

```
 //表锁
mysql> show global status like 'table_locks%';  
+-----------------------+---------+  
| Variable_name         | Value   |  
+-----------------------+---------+  
| Table_locks_immediate | 42579   |  
| Table_locks_waited    | 200     |  
+-----------------------+---------+  
Table_locks_immediate 表示立即释放表锁数，Table_locks_waited表示需要等待的表锁数。
如果 Table_locks_immediate / Table_locks_waited > 5000，最好采用InnoDB引擎，因为InnoDB是行锁而MyISAM是表锁，对于高并发写入的应用InnoDB效果会好些. 
如果InnoDB中，该值较高，并且有性能问题，应首先优化查询

//行锁
mysql> show status like 'innodb_row_lock%';

+-------------------------------+-------+
| Variable_name                 | Value |
+-------------------------------+-------+
| InnoDB_row_lock_current_waits | 0     |
| InnoDB_row_lock_time          | 0     |
| InnoDB_row_lock_time_avg      | 0     |
| InnoDB_row_lock_time_max      | 0     |
| InnoDB_row_lock_waits         | 0     |
+-------------------------------+-------+
如果发现锁争用比较严重，如InnoDB_row_lock_waits和InnoDB_row_lock_time_avg的值比较高，
还可以通过设置InnoDB Monitors来进一步观察发生锁冲突的表、数据行等，并分析锁争用的原因。
//创建监视器
CREATE TABLE innodb_monitor(a INT) ENGINE=INNODB;
//查询状态
show engine innodb status
//关闭监视器
DROP TABLE innodb_monitor;
```

**InnoDB缓存（缓存数据和索引）**
```
mysql> show global variables like 'innodb_buffer_pool_size';
+-------------------------+-----------+
| Variable_name           | Value     |
+-------------------------+-----------+
| innodb_buffer_pool_size | 536870912 |
+-------------------------+-----------+

那么如何设置该参数大小呢？首先查看运行时buffer pool相关数据指标：

mysql> show global status like 'Innodb_buffer_pool_pages_data';
+-------------------------------+-------+
| Variable_name                 | Value |
+-------------------------------+-------+
| Innodb_buffer_pool_pages_data | 9696  |
+-------------------------------+-------+

mysql> show global status like 'Innodb_buffer_pool_pages_total';
+--------------------------------+-------+
| Variable_name                  | Value |
+--------------------------------+-------+
| Innodb_buffer_pool_pages_total | 32764 |
+--------------------------------+-------+

mysql> show global status like 'Innodb_page_size';
+------------------+-------+
| Variable_name    | Value |
+------------------+-------+
| Innodb_page_size | 16384 |
+------------------+-------+

上述三项指标的含义如下：

Innodb_buffer_pool_pages_data
The number of pages in the InnoDB buffer pool containing data. The number includes both dirty and clean pages.

Innodb_buffer_pool_pages_total
The total size of the InnoDB buffer pool, in pages.

Innodb_page_size
InnoDB page size (default 16KB). Many values are counted in pages; the page size enables them to beeasily converted to bytes

计算Innodb_buffer_pool_pages_data/Innodb_buffer_pool_pages_total*100%
当结果 > 95% 则增加 innodb_buffer_pool_size， 建议使用物理内存的 75%
当结果 < 95% 则减少 innodb_buffer_pool_size， 
建议设置大小为： Innodb_buffer_pool_pages_data* Innodb_page_size * 1.05 / (1024*1024*1024)
命令如：SET GLOBAL innodb_buffer_pool_size= 22222223：单位kb
```

**查询缓存**
```
mysql> show global status like 'qcache%';
+-------------------------+-----------+
| Variable_name           | Value     |
+-------------------------+-----------+
| Qcache_free_blocks      | 3         |
| Qcache_free_memory      | 3128864   |
| Qcache_hits             | 224134    |
| Qcache_inserts          | 382       |
| Qcache_lowmem_prunes    | 0         |
| Qcache_not_cached       | 6741      |
| Qcache_queries_in_cache | 40        |
| Qcache_total_blocks     | 95        |
+-------------------------+-----------+

Qcache_free_blocks：缓存中相邻内存块的个数。数目大说明可能有碎片
Qcache_free_memory：缓存中的空闲内存。 
Qcache_hits：每次查询在缓存中命中时就增大
Qcache_inserts：每次插入一个查询时就增大
Qcache_lowmem_prunes：缓存出现内存不足并且必须要进行清理以便为更多查询提供空间的次数。这个数字最好长时间来看;如果这个数字在不断增长，就表示可能碎片非常严重，或者内存很少。(上面的 free_blocks和free_memory可以告诉您属于哪种情况) 
Qcache_not_cached：不适合进行缓存的查询的数量，通常是由于这些查询不是 SELECT 语句或者用了now()之类的函数。
Qcache_queries_in_cache：当前缓存的查询(和响应)的数量。
Qcache_total_blocks：缓存中块的数量。

若开启query cache，则对query cache 命中率进行监控也是必须的，query cache命中率计算如下：
query_cache_hits =(Qcache_hits/(Qcache_hits+Qcache_inserts))* 100%;


mysql> show variables like 'query_cache%';
+------------------------------+-----------+
| Variable_name                | Value     |
+------------------------------+-----------+
| query_cache_limit            | 2097152   |
| query_cache_min_res_unit     | 2048      |
| query_cache_size             | 536870912 |
| query_cache_type             | OFF       |
| query_cache_wlock_invalidate | OFF       |
+------------------------------+-----------+

query_cache_limit：超过此大小的查询将不缓存
query_cache_min_res_unit：缓存块的最小大小
query_cache_size：查询缓存大小
query_cache_type：缓存类型，决定缓存什么样的查询，示例中表示不缓存 select sql_no_cache 查询 
query_cache_wlock_invalidate：当有其他客户端正在对MyISAM表进行写操作时，如果查询在query cache中，是否返回cache结果还是等写操作完成再读表获取结果。

If you often have recurring queries for tables that are not updated frequently,
enable the query cache:
query_cache_type = 1
query_cache_size = 10M
```

其他优化，比如长连接和短链接的问题
