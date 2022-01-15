
---
title: Redis之慢查询日志
date: 2018-08-01T11:18:15+08:00
weight: 70
slug: cache-redis-slowlog
tags: ["redis"]
categories: ["cache"]
author: "nicky_chin"
comments: true
share: true
draft: false
---



> `Redis`提供了5种数据结构,但除此之外,`Redis`还提供了注入慢查询分析,`Redis Shell`、`Pipeline`、事务、与`Lua`脚本、`Bitmaps`、`HyperLogLog`、`PubSub`、`GEO`等附加功能,这些功能可以在某些场景发挥很重要的作用.

### 慢查询分析

许多存储系统(如:`MySQL`)提供慢查询日志帮助开发与运维人员定位系统存在的慢操作.所谓慢查询日志就是系统在命令执行前后计算每条命令的执行时间,当超过预设阈值,就将这条命令的相关信息(例如:发生时间,耗时,命令的详细信息)记录到慢查询日志中,`Redis`也提供了类似的功能.

**`Redis`命令执行流程:**
![执行流程](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510094707.png)


1.  发送命令

2.  命令排队

3.  命令执行

4.  返回结果

需要注意,慢查询只统计步骤`3`的时间,所以没有慢查询并不代表客户端没有超时问题.

#### 1) 慢查询的两个配置参数

对于慢查询功能,需要明确两件事:

*   预设阈值怎么设置?

*   慢查询记录存放在那?

`Redis`提供了`slowlog-log-slower-than`和`slowlog-max-len`配置来解决这两个问题.从字面意思就可以看出,`slowlog-log-slower-than`就是这个预设阈值,它的单位是毫秒(`1秒=1000000微秒`)默认值是`10000`,假如执行了一条"很慢"的命令(例如`key *`),如果执行时间超过`10000微秒`,那么它将被记录在慢查询日志中.

> 如果`slowlog-log-slower-than=0`会记录所有命令,`slowlog-log-slower-than<0`对于任何命令都不会进行记录.

从字面意思看,`slowlog-max-len`只是说明了慢查询日志最多存储多少条,并没有说明存放在哪里?实际上`Redis`使用了一个列表来存储慢查询日志,`slowlog-max-len`就是列表的最大长度.一个新的命令满足慢查询条件时被插入到这个列表中,当慢查询日志列表已处于其最大长度时,最早插入的一个命令将从列表中移出,例如`slowlog-max-len`设置长度为`64`.当有第`65`条慢查询日志插入的话,那么队头的第一条数据就出列,第`65`条慢查询就会入列.

在`Redis`中有两种修改配置的方法,一种是修改配置文件,另一种是使用`config set`命令动态修改.例如下面使用`config set`命令将`slowlog-log-slower-than`设置为`20000微妙`.`slowlog-max-len`设置为`1024`:

```
    config set slowlog-log-slower-than 20000
    config set slowlog-max-len 1024
    config rewrite
```

如果需要将`Redis`将配置持久化到本地配置文件,要执行`config rewrite`命令.如下:

![配置持久化](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510094640.png)


虽然慢查询日志存放在`Redis`内存列表中,但是`Redis`并没有暴露这个列表的键,而是通过一组命令来实现对慢查询日志的访问和管理.

(1) 获取慢查询日志

```
slowlog get [n]
```

参数`n`可以指定条数.

例:

```
    127.0.0.1:6370> slowlog get
    1) 1) (integer) 666
       2) (integer) 1456786500
       3) (integer) 11615
       4) 1) "BGREWRITEAOF"
    2) 1) (integer) 665
       2) (integer) 1456718400
       3) (integer) 12006
       4) 1) "SETEX"
          2) "video_info_200"
          3) "300"
          4) "2"
...
```

可以看到每个查询日志有4个属性组成,分别是慢查询日志的表示`id`、发生时间戳、命令耗时、执行命令和参数,慢查询列表:

![命令参数](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510094735.png)


(2) 获取慢查询日志列表当前长度

```
slowlog len
```

例如,当前`Redis`中有`45`条慢查询:

```
    127.0.0.1:6370> slowlog len
    (integer) 23
```

(3) 慢查询日志重置

```
slowlog reset
```

实际是对列表做清理操作,例如:

```
    127.0.0.1:6370> slowlog len
    (integer) 23
    127.0.0.1:6370> slowlog reset
    OK
    127.0.0.1:6370> slowlog len
    (integer) 0
```

#### 2) 实践

慢查询功能可以有效地帮助我们找到`Redis`可能存在的瓶颈,但在实际使用过程中要注意以下几点:

*   `slowlog-max-len`:线上建议调大慢查询列表,记录慢查询时`Redis`会对长命令做阶段操作,并不会占用大量内存.增大慢查询列表可以减缓慢查询被剔除的可能,例如线上可设置为`1000`以上.

*   `slowlog-log-slower-than`:默认值超过`10`毫秒判定为慢查询,需要根据`Redis`并发量调整该值.由于`Redis`采用单线程相应命令,对于高流量的场景,如果命令执行时间超过`1`毫秒以上,那么`Redis`最多可支撑`OPS`不到`1000`因此对于高OPS场景下的`Redis`建议设置为`1`毫秒.

*   慢查询只记录命令的执行时间,并不包括命令排队和网络传输时间.因此客户端执行命令的时间会大于命令的实际执行时间.因为命令执行排队机制,慢查询会导致其他命令级联阻塞,因此客户端出现请求超时时,需要检查该时间点是否有对应的慢查询,从而分析是否为慢查询导致的命令级联阻塞.

*   由于慢查询日志是一个先进先出的队列,也就是说如果慢查询比较多的情况下,可能会丢失部分慢查询命令,为了防止这种情况发生,可以定期执行`slowlog get`命令将慢查询日志持久化到其他存储中(例如:`MySQL`、`ElasticSearch`等),然后可以通过可视化工具进行查询.

# Reference
 [Redis高级功能 - 慢查询日志](https://segmentfault.com/a/1190000009915519)
