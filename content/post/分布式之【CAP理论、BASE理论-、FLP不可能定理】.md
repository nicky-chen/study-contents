

---
title: 分布式之【CAP理论、BASE理论 、FLP不可能定理】
date: 2018-04-25T11:18:15+08:00
weight: 70
slug: cap-base-flp
tags: ["理论"]
categories: ["distribution"]
author: "nicky_chin"
comments: true
share: true
draft: false
---

# 1.分布式系统的CAP理论

## 1.1 CAP理论概述

2000年7月，加州大学伯克利分校的Eric Brewer教授在ACM PODC会议上提出CAP猜想。2年后，麻省理工学院的Seth Gilbert和Nancy Lynch从理论上证明了CAP。之后，CAP理论正式成为分布式计算领域的公认定理。

一个分布式系统最多只能同时满足一致性（Consistency）、可用性（Availability）和分区容错性（Partition tolerance）这三项中的两项。

![cap](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510103252.png)


## 1.2 CAP的定义

### 1.2.1 Consistency 一致性

一致性指“`all nodes see the same data at the same time`”，即更新操作成功并返回客户端完成后，所有节点在同一时间的数据完全一致。分布式的一致性

对于一致性，可以分为从客户端和服务端两个不同的视角。从客户端来看，一致性主要指的是多并发访问时更新过的数据如何获取的问题。从服务端来看，则是更新如何复制分布到整个系统，以保证数据最终一致。一致性是因为有并发读写才有的问题，因此在理解一致性的问题时，一定要注意结合考虑并发读写的场景。

从客户端角度，多进程并发访问时，更新过的数据在不同进程如何获取的不同策略，决定了不同的一致性。对于关系型数据库，要求更新过的数据能被后续的访问都能看到，这是强一致性。如果能容忍后续的部分或者全部访问不到，则是弱一致性。如果经过一段时间后要求能访问到更新后的数据，则是最终一致性。

### 1.2.2 Availability 可用性

可用性指“`Reads and writes always succeed`”，即服务一直可用，而且是正常响应时间。

对于一个可用性的分布式系统，每一个非故障的节点必须对每一个请求作出响应。也就是，该系统使用的任何算法必须最终终止。当同时要求分区容忍性时，这是一个很强的定义：即使是严重的网络错误，每个请求必须终止。

好的可用性主要是指系统能够很好的为用户服务，不出现用户操作失败或者访问超时等用户体验不好的情况。可用性通常情况下可用性和分布式数据冗余，负载均衡等有着很大的关联。

### 1.2.3 Partition Tolerance分区容错性

分区容错性指“`the system continues to operate despite arbitrary message loss or failure of part of the system`”，即分布式系统在遇到某节点或网络分区故障的时候，仍然能够对外提供满足一致性和可用性的服务。

分区容错性和扩展性紧密相关。在分布式应用中，可能因为一些分布式的原因导致系统无法正常运转。好的分区容错性要求能够使应用虽然是一个分布式系统，而看上去却好像是在一个可以运转正常的整体。比如现在的分布式系统中有某一个或者几个机器宕掉了，其他剩下的机器还能够正常运转满足系统需求，或者是机器之间有网络异常，将分布式系统分隔未独立的几个部分，各个部分还能维持分布式系统的运作，这样就具有好的分区容错性。

## 1.3 CAP的证明

![cap1.png](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510103325.png)


如上图，是我们证明CAP的基本场景，网络中有两个节点N1和N2，可以简单的理解N1和N2分别是两台计算机，他们之间网络可以连通，N1中有一个应用程序A，和一个数据库V，N2也有一个应用程序B2和一个数据库V。现在，A和B是分布式系统的两个部分，V是分布式系统的数据存储的两个子数据库。

在满足一致性的时候，N1和N2中的数据是一样的，V0=V0。在满足可用性的时候，用户不管是请求N1或者N2，都会得到立即响应。在满足分区容错性的情况下，N1和N2有任何一方宕机，或者网络不通的时候，都不会影响N1和N2彼此之间的正常运作。

![cap2.png](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510103344.png)


如上图，是分布式系统正常运转的流程，用户向N1机器请求数据更新，程序A更新数据库Vo为V1，分布式系统将数据进行同步操作M，将V1同步的N2中V0，使得N2中的数据V0也更新为V1，N2中的数据再响应N2的请求。

这里，可以定义N1和N2的数据库V之间的数据是否一样为一致性；外部对N1和N2的请求响应为可用行；N1和N2之间的网络环境为分区容错性。这是正常运作的场景，也是理想的场景，然而现实是残酷的，当错误发生的时候，一致性和可用性还有分区容错性，是否能同时满足，还是说要进行取舍呢？

作为一个分布式系统，它和单机系统的最大区别，就在于网络，现在假设一种极端情况，N1和N2之间的网络断开了，我们要支持这种网络异常，相当于要满足分区容错性，能不能同时满足一致性和响应性呢？还是说要对他们进行取舍。

![cap3.png](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510103405.png)


假设在N1和N2之间网络断开的时候，有用户向N1发送数据更新请求，那N1中的数据V0将被更新为V1，由于网络是断开的，所以分布式系统同步操作M，所以N2中的数据依旧是V0；这个时候，有用户向N2发送数据读取请求，由于数据还没有进行同步，应用程序没办法立即给用户返回最新的数据V1，怎么办呢？有二种选择，第一，牺牲数据一致性，响应旧的数据V0给用户；第二，牺牲可用性，阻塞等待，直到网络连接恢复，数据更新操作M完成之后，再给用户响应最新的数据V1。

这个过程，证明了要满足分区容错性的分布式系统，只能在一致性和可用性两者中，选择其中一个。

## 1.4 CAP权衡

通过CAP理论，我们知道无法同时满足一致性、可用性和分区容错性这三个特性，那要舍弃哪个呢？

> CA without P：如果不要求P（不允许分区），则C（强一致性）和A（可用性）是可以保证的。但其实分区不是你想不想的问题，而是始终会存在，因此CA的系统更多的是允许分区后各子系统依然保持CA。
> 
> CP without A：如果不要求A（可用），相当于每个请求都需要在Server之间强一致，而P（分区）会导致同步时间无限延长，如此CP也是可以保证的。很多传统的数据库分布式事务都属于这种模式。
> 
> AP wihtout C：要高可用并允许分区，则需放弃一致性。一旦分区发生，节点之间可能会失去联系，为了高可用，每个节点只能用本地数据提供服务，而这样会导致全局数据的不一致性。现在众多的NoSQL都属于此类。

对于多数大型互联网应用的场景，主机众多、部署分散，而且现在的集群规模越来越大，所以节点故障、网络故障是常态，而且要保证服务可用性达到N个9，即保证P和A，舍弃C（退而求其次保证最终一致性）。虽然某些地方会影响客户体验，但没达到造成用户流程的严重程度。

对于涉及到钱财这样不能有一丝让步的场景，C必须保证。网络发生故障宁可停止服务，这是保证CA，舍弃P。貌似这几年国内银行业发生了不下10起事故，但影响面不大，报到也不多，广大群众知道的少。还有一种是保证CP，舍弃A。例如网络故障事只读不写。

孰优孰略，没有定论，只能根据场景定夺，适合的才是最好的。


# 2.分布式系统的BASE理论

## 2.1 BASE理论

> eBay的架构师Dan Pritchett源于对大规模分布式系统的实践总结，在ACM上发表文章提出BASE理论，BASE理论是对CAP理论的延伸，核心思想是即使无法做到强一致性（Strong Consistency，CAP的一致性就是强一致性），但应用可以采用适合的方式达到最终一致性（Eventual Consitency）。

BASE是指基本可用（Basically Available）、软状态（ Soft State）、最终一致性（ Eventual Consistency）。

### 2.1.1 基本可用（Basically Available）

基本可用是指分布式系统在出现故障的时候，允许损失部分可用性，即保证核心可用。

电商大促时，为了应对访问量激增，部分用户可能会被引导到降级页面，服务层也可能只提供降级服务。这就是损失部分可用性的体现。

### 2.1.2 软状态（ Soft State）

软状态是指允许系统存在中间状态，而该中间状态不会影响系统整体可用性。分布式存储中一般一份数据至少会有三个副本，允许不同节点间副本同步的延时就是软状态的体现。mysql replication的异步复制也是一种体现。

### 2.1.3 最终一致性（ Eventual Consistency）

最终一致性是指系统中的所有数据副本经过一定时间后，最终能够达到一致的状态。弱一致性和强一致性相反，最终一致性是弱一致性的一种特殊情况。

## 2.2 ACID和BASE的区别与联系

ACID是传统数据库常用的设计理念，追求强一致性模型。BASE支持的是大型分布式系统，提出通过牺牲强一致性获得高可用性。

ACID和BASE代表了两种截然相反的设计哲学

在分布式系统设计的场景中，系统组件对一致性要求是不同的，因此ACID和BASE又会结合使用


# 3.FLP不可能原理

### **3.1 FLP impossibility背景**

作为分布式系统历史中最重要的一个定理之一, FLP是每个做分布式系统的开发人员都应该深刻理解的一个基础. 但是FLP的证明过程不是特别容易, 原文中作者撰文非常简练精确, 本文通过一些例子和不太严格但是容易理解的语言来帮助读者理解FLP的证明过程。

FLP给出了一个令人吃惊的结论：在异步通信场景，即使只有一个进程失败，也没有任何算法能保证非失败进程达到一致性！

因为同步通信中的一致性被证明是可以达到的，因此在之前一直有人尝试各种算法解决以异步环境的一致性问题，有个FLP的结果，这样的尝试终于有了答案。

FLP证明最难理解的是没有一个直观的sample，所有提到FLP的资料中也基本都回避了sample的要求。究其原因，sample难以设计，除非你先设计几种一致性算法，并用FLP说明这些算法都是错误的。

### 3.2 系统模型

任何分布式算法或定理，都尤其对系统场景的假设，这称为系统模型。FLP基于下面几点假设：

*   异步通信
    与同步通信的最大区别是没有时钟、不能时间同步、不能使用超时、不能探测失败、消息可任意延迟、消息可乱序
*   通信健壮
    只要进程非失败，消息虽会被无限延迟，但最终会被送达；并且消息仅会被送达一次（无重复）
*   fail-stop模型
    进程失败如同宕机，不再处理任何消息。相对Byzantine模型，不会产生错误消息
*   失败进程数量
    最多一个进程失败

在现实中，我们都使用TCP协议（保证了消息健壮、不重复、不乱序），每个节点都有NTP时钟同步（可以使用超时），纯的异步场景相对比较少。但随着只能终端的发展，每个手机会为省电而关机，也会因为不在服务区而离线，这样的适用场景还是存在。

我们再衡量一个分布式算法是否正确时有三个标准：

## 3.3 Consensus定义:

1.  termination: 所有进程最终会在有限步数中结束并选取一个值, 算法不会无尽执行下去.
2.  agreement: 所有进程必须同意同一个值.
3.  validity: 最终达成一致的值必须是V1到Vn其中一个, 如果所有初始值都是vx, 那么最终结果也必须是vx.

这里我们对于第二个条件, 我们弱化为只要有一个进程做出了决定即可.

首先, 排除Byzantine式故障. 消息系统是异步的, 但是任何消息都会被接收一次且仅一次, 并且无法伪造或者丢失. 这是比一般的异步网络更加可靠的一个网络模型. 这样收窄的一个模型如果不能有一个完全正确的consensus protocol, 那么一般的异步网络或者包含Byzantine故障的模型更不可能有正确的protocol. 这是完全正确(totally correct)是指同时满足safety和liveness. 在实际应用中, Paxos, Raft, PBFT都是保证safety但是不保证liveness的, 所以他们都不是完全正确的算法, 理论上存在进入无限循环的可能性(实际上概率非常低, 在工程中完全可以使用).

关于异步网络和故障模型, 请参考[http://danielw.cn/network-failure-models/](http://danielw.cn/network-failure-models/).

Consensus protocol定义: 异步网络中的N个进程(N不小于2), 每个进程都有一个输入xp和输出yp的寄存器, 每个p的输入xp取值为{0, 1}其中一个, 这叫做一个进程的初始状态. 每个进程的表决结果输出到寄存器yp里, yp的取值范围为{b, 0, 1}, 其中初始状态必须为b, 一旦产生表决结果则变成0或者1, 这时候这个进程的状态叫做decision state, 一旦进入decision state, yp就不可以再变化. 每次内部状态的变化过程叫做transistion function, 他是deterministic的. 因为表决值只能是b(未决定), 0, 和1, 所以这是一个比较简化的模型. 这个protocol记作P.

进程之间通过消息通信, 一个消息e = (p, m). 其中p是目标进程, m是消息值. 整个消息系统叫做message buffer, 相当于一个multiset(每个进程拥有自己的FIFO消息队列, 如同erlang信箱一样). message buffer里包含着已经发出但是还没有收到的消息. message buffer支持两个操作:

1.  send(p, m): 把一个消息(p, m)放到message buffer中.
2.  receive(p): p从message buffer删除并取得消息值m, 或者返回null. 前者表示消息被接收到, 如果message buffer为空后者表示没有p的消息, 如果message buffer不为空表示p的消息传输被延迟. 注意, p的消息被延迟的次数有上限, 任何消息最终都会被收到.

一个configuration(状态)就是指所有进程的内部状态和message buffer状态. 整个系统总是从一个configuration变化为另外一个configuration. 这个变化过程叫做step, 一个step取决于message buffer返回消息的情况, 因为receive(p)返回的是M还是null, 而transition function是deterministic的, 所以下一个configuration取决于message buffer的返回值. 这个消息被接受处理的过程叫做event(p, m), 消息被延迟的事件叫做event(p, null). 这些steps叫做一个run, 如果结果的configuration有任何一个进程的yp={0,1}那么着叫做一个deciding run, 这个configuration已经有了表决结果. 因为只要有一个进程能够进入decision state那么整个configuration就算是0-valent或者1-valent了.

![image](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510103435.png)

一个configuration的一个schedule(事件序列)记作𝞂, 它包含了从这个configuration起, 一系列的事件. 比如(p1, m1), (p2, m2), (p3, m3)….

一个configuration如果无论后继的事件如何都会进入选择0的状态, 这叫做0-valent. 如果总是会进入选择1的状态, 这叫做1-valent. 如果两种情况都可能发生, 那么叫做bi-valent.

# Lemma 1

> Suppose that from some configuration C, the schedulers 𝞂1, 𝞂2 lead to configurations C1, C2, respectively. If the sets of processes taking steps in 𝞂1 and 𝞂2, respectively, are disjoint, then 𝞂2 can be applied to C1 and 𝞂1 can be applied to C2, and both lead to the same configuration C3.

这条引理表示如果一个C里有两组事件, 每个事件(p, m)分别是在两组没有交互的进程上, 那么先使用任何一组事件再使用另外一组事件在C上, 结果都一样. 下图描述了这样的情况.

![image](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510103723.png)

这个引理太容易理解了, 就不做证明了. 不过我们可以举个例子来描述一下: 比如Paxos算法中, 假设有A, B, C, D四个节点, 𝞂1是B收到了A的第一阶段消息, 𝞂2是D收到了C的第一阶段消息. 那么消息无论是先𝞂1, 𝞂2的顺序被送达还是按照𝞂2, 𝞂1的顺序, 结果都一样, 因为A/B是一组进程, C/D是一组进程, 𝞂1和𝞂2分别作用于这两组不相交的进程上.

![image](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510103804.png)

# Lemma 2

> P has a bivalent initial configuration

任何一个协议P一定会有bivalent初始configuration. 这是由于异步网络的本质造成的. 因为异步网络的消息顺序不一定, 所以对同一个初始configuration都可能会运行产生不同的结果. 证明如下:

反证法, 假设协议P没有bivalent initial configuration, 那么P的initial configuration不是0-valent就是1-valent. 实际上一定是二者都包含的. 因为consensus问题的第三条属性validity要求结果必须是某个结点提议的, 如果某个initial configuration中全体节点都是0, 那么结果一定是0, 不可能全体是0结果是1, 所以P的initial configurations全体为0和全体为1的两种情况必须产生0和1的结果, 也就是说必须同时包含0-valent和1-valent.

我们把所有只差一个进程的p上的xp变量不同的两个configuration叫做相邻(adjacent). 因为同时存在0-valent和1-valent的configurations, 假设是C和C’, 那么从C到C’一定有一个路径上, 至少存在一处相邻的C0和C1, 使得C0是0-valent, C1是1-valent. 下图是一个只有三个进程(p0, p1, p2)的所有initial configuration的情况, 线条连接的是相邻的两个configuration.

![image](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510103913.png)

假设p是C0和C1之间状态不同的那个进程, 如果p发生了故障不工作了, p不再从buffer里获得任何消息, 那么C0和C1如果排除了p之后其实状态是一样的, 那么排除了p之后C0上的某个事件序列𝞂也可以应用在C1上, 而且结果相同. 因为C0是0-valent的, C1是1-valent的, 他们的结果应该分别是0和1, 这和他们排除p之后结果相同的推论矛盾.

比如上图中的{0,0,0}和{1,1,1}分别是C和C’, 那么可能在{0,0,0} - {0,1,0} - {1,1,0} - {1,1,1}这条路径上, {0,1,0}和{1,1,0}就是C0和C1的分界点, 他们之间只差了一个p0的状态不同. 如果p发生故障不从message buffer里收消息, 那么排除掉p, 其实C0和C1都是{1,0}的状态了. 而C0和C1在没有p的情况下必然结果一样, 这和C0/C1分别是0-valent/1-valent矛盾.

这个引理的本质是:一个故障节点停止接受消息, 会使结果不确定. 举个例子, 我们设计一个consensus算法, 规则如下: 有A/B/C三个节点, A作为leader对B/C做类似于两阶段提交的询问, A先告诉B/C期望的结果, B/C接受并返回应答, 只有收到应答之后A才能做出决定并发出第二个请求给B/C做提交, 如果A发生了故障, 那么B作为leader对C询问. 那么我们设计一个0-valent的C0和一个1-valent的C1分别如下:

C0=A建议0给B/C. B/C自己都倾向于1.

C1=A建议1给B/C. B/C自己都倾向于1.

明显, 如果没有任何故障, C0结果是0, C1结果是1\. 因为C0和C1只差一个进程A不同, 假设A进程挂了, 那么C0’和C1’其实是一样的, 这时候他们俩结果应该是一致的, 应该都是1\. 但是这和C0就算有一个故障节点也应该结果为0矛盾.

![image](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510103942.png)

我们通过反证法证明了一个协议P必然包含bivalent initial configuraiton. 本质上这是异步网络中一个没有响应的节点导致的结果不确定性.

# Lemma 3

Let C be a bivalent configuration of P, and let e=(p, m) be an event that is applicable to C. Let Ɛ be the set of configurations reachable from C without applying e, and let Ɗ = e(Ɛ) = {e(E) when E∈Ɛ and e is applicable to E}. Then, Ɗ contains a bivalent configuration.

这是整个证明的核心部分, 这部分比较难理解. 首先C不是initial configuration了, C可能是某个中间过程的configuration, 然后C是bivalent的. 假设e=(p, m)这个消息是可以应用于C的, 那么不用e所能达到的所有configuration应该是一幅图. 这个图就是Ɛ. Ɛ内任何一个configuration再用e就跳出Ɛ, 并得到了一个集合Ɗ. 每一个’Ɛ边界’上的configuration就是E, 因而有D=e(E).

如果把e用于Ɛ中某一个configuration, 那么相当于Ɛ中离起始的C越远的configuration收到e越晚, e越被延迟. 由于我们定义了Ɛ不含e, 所以e只会发生在Ɛ的边界上, 实际上就是把e延迟成为离开Ɛ进入Ɗ的最后一个消息. e会把Ɛ内每一个configuration映射到Ɗ 中一个configuration.

我们要证明Ɗ包含bivalent configuration, 我们反证它. 假设D没有bivalent configuration, 那么Ɗ只能包含0-valent和1-valent. 也就是说e回把Ɛ中每一个边界的configuration变为(映射为)Ɗ 中的一个0-valent或者1-valent configuration. 按照这个思路, 因为C是bivalent, 所以一定会同时存在E0和E1分别是0-valent和1-valent. 接下来分两种情况分析:

如果E0还没有收到e, 那么E0属于Ɛ, 那么E0收到e之后会变成F0\. F0明显是0-valent并且属于Ɗ. 同样, 如果E1还没有收到e, 也会有F1属于Ɗ.

如果E0已经收到过e, 那么E0不属于Ɛ, 由于e是最后一个消息, 所以必然存在于Ɛ边界上一个configuration收到e之后变成F0进入Ɗ, 然后F0可能经过收到其他消息最终变成E0\. 根据反证假设, F0必须是0-valent. 类似的, 如果E1还没有收到e, 也会有F1属于Ɗ, 并且F1可以变成E1.

这两种情况下总是有一个E和F可以通过一个消息变成对方. 因为C是bivalent, 所以一定同时存在E0/E1, 那也就同时存在F0/F1\. 所以由反证假设可以得出结论: Ɗ总是同时包含0-valent和1-valent.

![image](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510104027.png)

那么我们按照这个假设, 我们从Ɛ中找两个configuration, C0和C1, 使得C0通过消息e’= (p’, m’)得到C1(此处C0和C1不表示他们是0-valent和1-valent, 0/1下标只是为了容易区分). 那么e能够把C0变成D0状态, e也可以把C1变成D1状态, 其中D0/D1是属于Ɗ 的0-valent和1-valent. 如下图所示:

![image](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510104054.png)

接下来我们又要分两种情况讨论. 第一种比较简单, 如果e’和e所接受消息的p’和p不同, 那么从C0开始, e’和e所作用的进程是离散不相交的, 根据lemma 1, C0上用了e再用e’和先用e’再用e的结果应该是一样的. 根据lemma 1, 我们把这个图稍微旋转一下, 会看到这样一幅图.

![image](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510104118.png)

红色是根据lemma 1加上去的, 但是这条红色的会把一个0-valent的D0变成1-valent的D1, 这是明显矛盾不可能的. 所以第一种情况不存在.

再看第二种情况, 假设p’和p相同. 这种情况更复杂一点. 任何一个从C0开始不含p的消息(p不工作)的有限步数的deciding run会得到一个0-valent或者1-valent的configuration A, 我们把这个deciding run的事件序列标记为𝞂. 因为𝞂不含p的事件, 所以它和e作用的进程不相交, 那么用lemma 1可以得出下图中的E0\. 同理, e’和e都作用于p, 所以e’和e的事件序列和𝞂作用的进程也不想交, 根据lemma 1可以得到E1.

![image](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510104225.png)

那么我们可以看出A可以变成E0也可以变成E1, 这说明A是bivalent的. 但是这和A是一个deciding run的结果矛盾. (A要么0-valent要么1-valent).

至此p=p’和p!=p’的两种情况在我们的反证假设下都矛盾, 因此反证假设错误. Lemma 3 证明完成, 即: Ɗ 一定包含bivalent configuration.

三个Lemma都证明结束后, 我们来推导最终FLP定理.

# FLP Theorem

> No Consensus protocol is totally correct in spite of one fault.

根据Lemma 2, P一定含有bivalent initial configuration, 那么任何从这个bivalent状态进入univalent的deciding run, 其中必然存在一个从bivalent到univalent的关键步骤, 这个步骤决定了最终结果. 我们接下来就是要证明系统中总是有可能会把这个步骤无限推迟下去.

我们设计一个队列, 把所有进程放到这个队列中, 按照FIFO的顺序每次一个进程出来, 这个进程从message buffer取出第一个此进程的消息, 把计算后发给其他进程的消息放回message buffer尾部, 然后进程自己回到队列尾部等待下一轮调度. 这个模型保证了每个进程总是有机会获得发送给他的消息. 根据Lemma 2我们知道y一定会存在一个bivalent的configuration C0, 从C0开始执行到某一个bivalent的C, 这时候message buffer中第一个C的消息是e. 再根据Lemma 3我们知道如果把e挪到message buffer后面延迟这个消息的送达, 那么C一定会再产生一个bivalent configuration C’进入Ɗ. 这意味着通过延迟e, 可以让一个bivalent configuration再产生一个bivalent configuraiton, 因为可能会永远无法达到一个univalent configuration, 也就永远无法产生结果.

# Reference
[FLP Impossibility的证明](http://danielw.cn/FLP-proof)
