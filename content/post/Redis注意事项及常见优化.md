
---
title: Redis注意事项及常见优化
date: 2018-08-07T11:18:15+08:00
weight: 70
slug: cache-redis-optimize
tags: ["redis"]
categories: ["cache"]
author: "nicky_chin"
comments: true
share: true
draft: false
---

# 1 键值设计
#### 1.1  key名设计

*   (1)【建议】: 可读性和可管理性

以业务名(或数据库名)为前缀(防止key冲突)，用冒号分隔，比如业务名:表名:id

```
roborder:user:1:amount
```

*   (2)【建议】：简洁性

保证语义的前提下，控制key的长度，当key较多时，内存占用也不容忽视，例如：

```
user:{uid}:friends:messages:{mid}
简化为 u:{uid}:fr:m:{mid}。
```

*   (3)【强制】：不要包含特殊字符

反例：包含空格、换行、单双引号以及其他转义字符

#### 1.2 value设计

*   (1)【强制】：拒绝bigkey(防止网卡流量、慢查询)

string类型控制在10KB以内，hash、list、set、zset元素个数不要超过5000。

反例：一个包含200万个元素的list。

非字符串的bigkey，不要使用del删除，使用**hscan、sscan、zscan方式渐进式删除**，同时要注意防止bigkey过期时间自动删除问题(例如一个200万的zset设置1小时过期，会触发del操作，造成阻塞，而且该操作不会不出现在慢查询中(latency可查))

*   (2)【推荐】：选择适合的数据类型。

例如：实体类型(要合理控制和使用数据结构内存*编码优化配置*,例如ziplist，但也要注意节省内存和性能之间的平衡)

反例：
```
set user:1:name tom
set user:1:age 19
set user:1:favor football
```

正例:

```
hmset user:1 name tom age 19 favor football
```

*   (3)【推荐】：控制key的生命周期，redis不是垃圾桶。

建议使用expire设置过期时间(条件允许可以打散过期时间，防止集中过期)，不过期的数据重点关注idletime。同时设置时间的时候注意原子性操作，否则可能出现死锁情况

*   (4)【推荐】hash，set，zset，list 存储过多的元素优化
可以将这些元素分拆，通过hash取模的方式
正常存取流程是 hget(hashKey, field) ; hset(hashKey, field, value)
现在，固定一个桶的数量，比如 100， 每次存取的时候，先在本地计算field的hash值，模除 100， 确定了该field落在哪个key上。

```
newHashKey  =  hashKey + hash(field) % 10000;   
hset (newHashKey, field, value) ;  
hget(newHashKey, field)
```
set, zset, list 也可以类似上述做法,如果对于顺序有严格要求的则不试用


# 2 命令使用注意点
1.【推荐】 O(N)命令关注N的数量
例如hgetall、lrange、smembers、zrange、sinter等并非不能使用，但是需要明确N的值。有遍历的需求可以使用hscan、sscan、zscan代替。
Redis的命令时间复杂度可以看这里[Redis复杂度O(N)](http://doc.redisfans.com/)

2.【推荐】：禁用命令
禁止线上使用keys、flushall、flushdb等，通过redis的rename机制禁掉命令，或者使用scan的方式渐进式处理。

3.【推荐】合理使用select
redis的多数据库较弱，使用数字进行区分，很多客户端支持较差，同时多业务用多数据库实际还是单线程处理，会有干扰。

4.【推荐】使用批量操作提高效率
原生命令：例如mget、mset。
非原生命令：可以使用pipeline提高效率，可以减少网络耗时
但要注意控制一次批量操作的元素个数(例如500以内，实际也和元素字节数有关)。

注意两者不同：

>1. 原生是原子操作，pipeline是非原子操作。在集群环境下如果key不在同一个slot上，那么mget、mset等操作为非原子性操作。
>2. pipeline可以打包不同的命令，原生做不到
>3. pipeline需要客户端和服务端同时支持。

5.【建议】Redis事务功能较弱，不建议过多使用
Redis的事务功能较弱(不支持回滚)，而且集群版本(自研和官方)要求一次事务操作的key必须在一个slot上(可以使用 _hashtag_ 功能解决)
**hashtag的解决方案**：可以使用twitter的 [twemproxy](https://github.com/twitter/twemproxy/blob/master/notes/recommendation.md#hash-tags)


6.【建议】Redis集群版本在使用Lua上有特殊要求：
1.所有key都应该由 KEYS 数组来传递，redis.call/pcall 里面调用的redis命令，key的位置，必须是KEYS array, 否则直接返回error，
`-ERR bad lua script for redis cluster, all the keys that the script uses should be passed using the KEYS array`
2.所有key，必须在1个slot上，否则直接返回error, `-ERR eval/evalsha command keys must in same slot`
 使用可以参考：[阿里云redis集群使用lua脚本](https://blog.csdn.net/mushuntaosama/article/details/78788254)

7.【建议】必要情况下使用monitor命令时，要注意不要长时间使用,否则内出会飙高

# 3 配置属性优化

*maxclients*
限制同时连接的客户数量。当连接数超过这个值时， redis 将不再接收其他连接请求，客户端尝试连接时将收到 error 信息。特殊值"0"表示没有限制。

*timeout*
设置客户端连接时的超时时间，单位为秒。当客户端在这段时间内没有发出任何指令，那么关闭该连接，默认为0则表示没有超时时间，如果设定了超时时间，需要注意客户端redis连接池的timeout问题

*client-output-buffer-limit*
```
config set client-output-buffer-limit ‘slave 256mb 64mb 60’
```
这里对是客服端是slave的做限制
256mb 是一个硬性限制，当output-buffer的大小大于256mb之后就会断开连接。64mb 60 是一个软限制，当output-buffer的大小大于64mb并且超过了60秒的时候就会断开连接，所以当预估有bigkeys的时候需要进行调试

*lua-time-limit*
限制脚本的最长运行时间，默认为5秒钟。当脚本运行时间超过这一限制后，Redis将开始接受其他命令但不会执行（以确保脚本的原子性，因为此时脚本并没有被终止），而是会返回“BUSY”错误，避免redis阻塞情况

*memory-policy*
 查询内存溢出策略   默认策略是volatile-lru，即超过最大内存后，在过期键中使用lru算法进行key的剔除，保证不过期数据不被删除，但是可能会出现OOM问题。
>maxmemory-policy 六种方式
1、volatile-lru：只对设置了过期时间的key进行LRU（默认值） 
2、allkeys-lru ： 删除lru算法的key   
3、volatile-random：随机删除即将过期key   
4、allkeys-random：随机删除   
5、volatile-ttl ： 删除即将过期的   
6、noeviction ： 永不过期，返回错误


# 4 集群批量操作优化

首先要知道一个概念叫**缓存无底洞问题**，该问题由 facebook 的工作人员提出的， facebook 在 2010 年左右，memcached 节点就已经达3000 个，缓存数千 G 内容。他们发现了一个问题---memcached 连接频率，效率下降了，于是加 memcached 节点，添加了后，发现因为连接频率导致的问题，仍然存在，并没有好转，称之为”无底洞现象”。

为什么会出现这个现象，请对比下面两张图片，图一是多IO版本，也就是说当存在的节点异常多的时候，IO的代价已经超过数据传输，上文提到的facebook的节点已经超过3000个，在这种情况下再增加节点已经没法再提高效率了。

图一 多IO版本

![io](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510094822.png)

图二 单IO版本

![io2](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510094845.png)

redis引入cluster模式后，批量获取操作mget也面临同样的问题。redis是传统的key-value的存储模式，RedisCluster将数据按key哈希到16384个slot上，每个redis node负责一部分的slot。mget需要执行的操作就是从redis node获取所有的key-value值，然后进行merge然后返回。

其实IO的优化思路都比较通用，无非就是提高命令本身效率，串行改并行，单个转批量。摘录一段网上的IO优化思路总结：

>(1) 命令本身的效率：例如sql优化，命令优化
(2) 网络次数：减少通信次数
(3) 降低接入成本:长连/连接池,NIO等
(4) IO访问合并:O(n)到O(1)过程:批量接口(mget)

**具体方案**

①串行命令：由于n个key是比较均匀地分布在Redis Cluster的各个节点上，因此无法使用mget命令一次性获取，所以通常来讲要获取n个key的值，最简单的方法就是逐次执行n个get命令，这种操作时间复杂度较高，它的操作时间=n次网络时间+n次命令时间，网络次数是n。很显然这种方案不是最优的，但是实现起来比较简单。
```

List<string> serialMGet (List<String> keys) { 
//结果集
List<string> values - new ArrayList<String>();
//n次串行get
for (String key : keys) {
String value = jediscluster.get (key);values.add (value);
} 
return values;
```

②串行IO：Redis Cluster使用CRC16算法计算出散列值，再取对16383的余数就可以算出slot值，同时Smart客户端会保存slot和节点的对应关系，有了这两个数据就可以将属于同一个节点的key进行归档，得到每个节点的key子列表，之后对每个节点执行mget或者Pipeline操作，它的操作时间=node次网络时间+n次命令时间，网络次数是node的个数，整个过程如下图所示，很明显这种方案比第一种要好很多，但是如果节点数太多，还是有一定的性能问题。
```

Map<String, String> serialIOMget (List<String> keys) {

        //结果集
        Map<String, String> keyValueMap = new HashMap<>();
        //属于各个节点的key列表,JedisPool要提供基于ip和port的hashcode方法
        Map<JedisPool, List<String>> nodeKeyListMap= new HashMap<>();
        //遍历所有的key
        for (String key : keys) {
            //使用CRC16本地计算每个key的slot
            int slot = JedisClusterCRC16.getSlot(key);
            //通过iediscluster本地slot->node映射获取slot对应的node
            JedisPool jedisPool = jedisCluster.getConnectionHandler().getJedisPoolFromSlot(slot);
            //归档
            if (nodeKeyListMap.containsKey(jedisPool)) {
                nodeKeyListMap.get(jedisPool).add(key);
            } else {
                List<String> list = new ArrayList<String>();
                list.add(key);
                nodeKeyListMap.put(jedisPool, list);
            }
        }
        //从每个节点上批量获取,这里使用mget也可以使用pipeline
        for (Map.Entry<JedisPool, List<String>> entry : nodeKeyListMap.entrySet()) {
            JedisPool jedisPool = entry.getKey();
            List<String> nodeKeyList = entry.getValue();
            //列表变为数组
            String[] nodeKeyArray = nodeKeyList.toArray(new String[nodeKeyList.size()]);
            //批量获取,可以使用mget或者Pipeline
            List<String> nodeValueList = jedisPool.getResource().mget(nodeKeyArray);
            //归档
            for (int i = 0; i < nodeKeyList.size(); i++) {
                keyValueMap.put(nodeKeyList.get(i), nodeValueList.get(i));
            }
        }
        return keyValueMap;
    }
```
![串行.png](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510094904.png)


③并行IO：此方案是将方案2中的最后一步改为多线程执行，网络次数虽然还是节点个数，但由于使用多线程网络时间变为O（1），这种方案会增加编程的复杂度。

![并行IO](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510094926.png)


④hash_tag实现：Redis Cluster的hash_tag功能，它可以将多个key强制分配到一个节点上，它的操作时间=1次网络时间+n次命令时间。

**四种方案对比**
![四种批量操作解决方案对比](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510095312.png)


# 其他工具及优化
*  **数据同步**

redis间数据同步可以使用：redis-port

*  **big key搜索**

[redis大key搜索工具](https://yq.aliyun.com/articles/117042)

*  **热点key寻找**(内部实现使用monitor，所以建议短时间使用)

[facebook的redis-faina](https://github.com/facebookarchive/redis-faina)

*  **其他**

[Jedis常见异常汇总](https://yq.aliyun.com/articles/236384)
[JedisPool资源池优化](https://yq.aliyun.com/articles/236383)


# Reference
数据库技术丛书 REDIS开发与运维
[阿里云Redis开发规范](https://yq.aliyun.com/articles/531067)
