
---
title: 数据结构之BTree和B+Tree(多路平衡查找树 )
date: 2018-11-17T11:18:15+08:00
weight: 70
slug: btree-info
tags: ["数据结构"]
categories: ["Algorithm"]
author: "nicky_chin"
comments: true
share: true
draft: false
---




# 1 背景
B-Tree是为磁盘等外存储设备设计的一种平衡查找树。因此在讲B-Tree之前先了解下磁盘的相关知识。系统从磁盘读取数据到内存时是以磁盘块（block）为基本单位的，位于同一个磁盘块中的数据会被一次性读取出来，而不是需要什么取什么。
InnoDB存储引擎中有页（Page）的概念，页是其磁盘管理的最小单位。InnoDB存储引擎中默认每个页的大小为16KB，可通过参数innodb_page_size将页的大小设置为4K、8K、16K，在MySQL中可通过如下命令查看页的大小：
```
mysql> show variables like 'innodb_page_size';
```

而系统一个磁盘块的存储空间往往没有这么大，因此InnoDB每次申请磁盘空间时都会是若干地址连续磁盘块来达到页的大小16KB。InnoDB在把磁盘数据读入到磁盘时会以页为基本单位，在查询数据时如果一个页中的每条数据都能有助于定位数据记录的位置，这将会减少磁盘I/O次数，提高查询效率。


# 2 定义与特性
**B-Tree**
B-Tree结构的数据可以让系统高效的找到数据所在的磁盘块。为了描述B-Tree，首先定义一条记录为一个二元组[key, data] ，key为记录的键值(关键字)，对应表中的主键值，data为一行记录中除主键外的数据。对于不同的记录，key值互不相同。

```
一棵m阶的B-Tree有如下特性： 
1. 每个节点最多有m个孩子。 
2. 除了根节点和叶子节点外，其它每个节点至少有Ceil(m/2)个孩子。 
3. 若根节点不是叶子节点，则至少有2个孩子 
4. 所有叶子节点都在同一层，且不包含其它关键字信息 
5. 每个非终端节点包含n个关键字信息（P0,P1,…Pn, k1,…kn） 
6. 关键字的个数n满足：ceil(m/2)-1 <= n <= m-1 
7. ki(i=1,…n)为关键字，且关键字升序排序。 
8. Pi(i=1,…n)为指向子树根节点的指针。P(i-1)指向的子树的所有节点关键字均小于ki，但都大于k(i-1)
```
B树中的每个节点根据实际情况可以包含大量的关键字信息和分支
如下图所示为一个3阶的B-Tree：

![b树](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509163823.png)

每个节点占用一个盘块的磁盘空间，一个节点上有两个升序排序的关键字和三个指向子树根节点的指针，指针存储的是子节点所在磁盘块的地址。两个关键词划分成的三个范围域对应三个指针指向的子树的数据的范围域。以根节点为例，关键字为17和35，P1指针指向的子树的数据范围小于17，P2指针指向的子树的数据范围为17~35，P3指针指向的子树的数据范围大于35

模拟查找关键字29的过程：
>根据根节点找到磁盘块1，读入内存。【磁盘I/O操作第1次】
比较关键字29在区间（17,35），找到磁盘块1的指针P2。
根据P2指针找到磁盘块3，读入内存。【磁盘I/O操作第2次】
比较关键字29在区间（26,30），找到磁盘块3的指针P2。
根据P2指针找到磁盘块8，读入内存。【磁盘I/O操作第3次】
在磁盘块8中的关键字列表中找到关键字29。
分析上面过程，发现需要3次磁盘I/O操作，和3次内存查找操作。由于内存中的关键字是一个有序表结构，可以利用二分法查找提高效率。而3次磁盘I/O操作是影响整个B-Tree查找效率的决定因素。B-Tree相对于AVLTree缩减了节点个数，使每次磁盘I/O取到内存的数据都发挥了作用，从而提高了查询效率。


**B+Tree**

B+Tree是在B-Tree基础上的一种优化，使其更适合实现外存储索引结构，InnoDB存储引擎就是用B+Tree实现其索引结构。

从B-Tree图可以看到每个节点中不仅包含数据的key值，还有data值。而每一个页的存储空间是有限的，如果data数据较大时将会导致每个节点（即一个页）能存储的key的数量很小，当存储的数据量很大时同样会导致B-Tree的深度较大，增大查询时的磁盘I/O次数，进而影响查询效率。在B+Tree中，所有数据记录节点都是按照键值大小顺序存放在同一层的叶子节点上，而非叶子节点上只存储key值信息，这样可以大大加大每个节点存储的key值数量，降低B+Tree的高度。

```
B+Tree相对于B-Tree有几点不同：
非叶子节点只存储键值信息。
所有叶子节点之间都有一个链指针。
数据记录都存放在叶子节点中。
```

将B-Tree优化，由于B+Tree的非叶子节点只存储键值信息，假设每个磁盘块能存储4个键值及指针信息，则变成B+Tree后其结构如下图所示:

![b+树](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509163905.png)

通常在B+Tree上有两个头指针，一个指向根节点，另一个指向关键字最小的叶子节点，而且所有叶子节点（即数据节点）之间是一种链式环结构。因此可以对B+Tree进行两种查找运算：一种是对于主键的范围查找和分页查找，另一种是从根节点开始，进行随机查找。

可能上面例子中只有22条数据记录，看不出B+Tree的优点，下面做一个推算：

InnoDB存储引擎中页的大小为16KB，一般表的主键类型为INT（占用4个字节）或BIGINT（占用8个字节），指针类型也一般为4或8个字节，也就是说一个页（B+Tree中的一个节点）中大概存储16KB/(8B+8B)=1K个键值（因为是估值，为方便计算，这里的K取值为10^3,计算可得深度为3的树可以存储10亿数量级数据

实际情况中每个节点可能不能填充满，因此在数据库中，B+Tree的高度一般都在2-4层。***mysql的InnoDB存储引擎在设计时是将根节点常驻内存的，也就是说查找某一键值的行记录时最多只需要1~3次磁盘I/O操作***

B+Tree索引可以分为聚集索引（clustered index）和非聚簇索引（secondary index）。上面B+Tree示例图在数据库中的实现即为聚集索引

![聚集索引](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509163938.png)

![非聚簇索引](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509164005.png)

聚集索引的B+Tree中的叶子节点存放的是整张表的行记录数据。非聚簇索引与聚集索引的区别在于非聚簇索引的叶子节点并不包含行记录的全部数据，而是存储相应行数据的聚集索引键，即主键。当通过非聚簇索引来查询数据时，InnoDB存储引擎会遍历非聚簇索引找到主键，然后再通过主键在聚集索引中找到完整的行记录数据


 # 3 B树
**3.1 分支关键字个数以及度数的范围简要总结**
```
一个m阶B-树：
1).对于根节点，子树(孩子或者称为分支)个数取值范围[2,m]，关键字个数范围[1,m-1]
2).对于内结点，分支数范围[ceil(m/2),m]，关键字个数的范围是ceil(m/2)-1,m-1]
3).对于最小度数为t>=2的结点，根节点关键字的个数范围: [1, 2*t - 1]，
非根节点关键字的个数范围: [t-1, 2*t - 1]，分支的个数范围：[t, 2*t]
```


**3.2 基本操作**
**3.2.1 插入操作（重点判断是否满足n<=m-1）**
对于m阶B-树他的节点关键字的个数n必须满足： [ceil(m / 2)-1]<= n <= m-1

>a.查找关键字的插入位置。若找到，则说明该关键字已经存在，直接返回。否则查找操作必失败于某个最低层的非终端结点上
>b.判断该结点是否还有空位,即该结点关键字总数是否满足n<=m-1。若满足，则该结点还有空位置，直接插入关键字到合适位置。若不满足，说明该结点己没空位，需要把结点分裂成两个
>分裂方法：生成一新结点。把原结点上的关键字和k按升序排序，从中间位置把关键字分成两部分。左部分关键字放在旧结点，右部分关键字放在新结点，中间位关键字连同新结点的存储位置插入到父结点中。如果父结点的关键字个数也超过（m-1），则要再分裂，再往上插。直至这个过程传到根结点为止

![insert1](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509164032.png)

![insert2](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509164052.png)

![insert3](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509164123.png)

![insert4](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509164157.png)

**3.2.2 删除操作**

*在B-树叶非叶结点一个关键字的方法*

若该结点为非叶结点，且被删关键字为该结点中第i个关键字key[i]，则可从指针child[i]所指的子树中找出最小关键字Y，代替key[i]的位置，然后在叶结点中删去Y。因此，把在非叶结点删除关键字k的问题就变成了删除叶子结点中的关键字的问题

![del1](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509164235.png)

*在B-树叶结点上删除一个关键字的方法*

a、被删关键字Ki所在结点的关键字数目不小于ceil(m/2)，则只需从结点中删除Ki和相应指针Ai，树的其它部分不变。
![del2](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509164254.png)

b、被删关键字Ki所在结点的关键字数目等于ceil(m/2)-1，则需调整。调整过程如上面所述。
![del3](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509164317.png)

c、被删关键字Ki所在结点和其相邻兄弟结点中的的关键字数目均等于ceil(m/2)-1，假设该结点有右兄弟，且其右兄弟结点地址由其双亲结点指针Ai所指。则在删除关键字之后，它所在结点的剩余关键字和指针，加上双亲结点中的关键字Ki一起，合并到Ai所指兄弟结点中（若无右兄弟，则合并到左兄弟结点中）。如果因此使双亲结点中的关键字数目少于ceil(m/2)-1，则依次类推.

![del4](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509164346.png)

![del5](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190509164405.png)

**3.3 java实现**
[B树java代码](https://github.com/nicky-chen/Alogmi/tree/master/src/com/nicky/tree/btree)

# Referfence
[B-树小结汇总](http://www.cnblogs.com/biyeymyhjob/archive/2012/07/25/2608412.html)
[BTree和B+Tree详解](http://www.cnblogs.com/vianzhang/p/7922426.html)
[MySQL索引背后的数据结构及算法原理](http://blog.codinglabs.org/articles/theory-of-mysql-index.html)
