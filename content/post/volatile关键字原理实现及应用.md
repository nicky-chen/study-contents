
---
title: volatile关键字原理实现及应用
date: 2018-05-04T11:18:15+08:00
weight: 70
slug: volatile-feature
tags: ["锁优化"]
categories: ["concurrent"]
author: "nicky_chin"
comments: true
share: true
draft: false
---

# 1.并发编程中的三个概念

在并发编程中, 需要了解线程的三个概念：原子性，可见性，有序性：

**1.1.原子性**

>原子性：即一个操作或者多个操作 要么全部执行并且执行的过程不会被任何因素打断，要么就都不执行。

一个很经典的例子就是银行账户转账问题：
```
比如从账户A向账户B转1000元，那么必然包括2个操作：从账户A减去1000元，往账户B加上1000元。

试想一下，如果这2个操作不具备原子性，会造成什么样的后果。假如从账户A减去1000元之后，操作突然中止。然后又从B取出了500元，取出500元之后，
再执行 往账户B加上1000元 的操作。这样就会导致账户A虽然减去了1000元，但是账户B没有收到这个转过来的1000元。

所以这2个操作必须要具备原子性才能保证不出现一些意外的问题。
```
　　同样地反映到并发编程中会出现什么结果呢？

　　举个最简单的例子，大家想一下假如为一个32位的变量赋值过程不具备原子性的话，会发生什么后果？
```
i = 9;
```
假若一个线程执行到这个语句时，我暂且假设为一个32位的变量赋值包括两个过程：为低16位赋值，为高16位赋值。
那么就可能发生一种情况：当将低16位数值写入之后，突然被中断，而此时又有一个线程去读取i的值，那么读取到的就是错误的数据。

**1.2.可见性**

>可见性是指当多个线程访问同一个变量时，一个线程修改了这个变量的值，其他线程能够立即看得到修改的值。

举个简单的例子，看下面这段代码：

```
//线程1执行的代码
int i = 0;
i = 10;
 
//线程2执行的代码
j = i;
```

 　　假若执行线程1的是CPU1，执行线程2的是CPU2。由上面的分析可知，当线程1执行 i =10这句时，会先把i的初始值加载到CPU1的高速缓存中，然后赋值为10，那么在CPU1的高速缓存当中i的值变为10了，却没有立即写入到主存当中。

　　此时线程2执行 j = i，它会先去主存读取i的值并加载到CPU2的缓存当中，注意此时内存当中i的值还是0，那么就会使得j的值为0，而不是10.
这就是可见性问题，线程1对变量i修改了之后，线程2没有立即看到线程1修改的值。

**1.3.有序性**

>有序性：即程序执行的顺序按照代码的逻辑顺序执行

举个简单的例子，看下面这段代码：
```
int i = 0;              
boolean flag = false;
i = 1;                //语句1  
flag = true;          //语句2
```

 　　上面代码定义了一个int型变量，定义了一个boolean类型变量，然后分别对两个变量进行赋值操作。从代码顺序上看，语句1是在语句2前面的，那么JVM在真正执行这段代码的时候会保证语句1一定会在语句2前面执行吗？不一定，为什么呢？这里可能会发生指令重排序。
    但是要注意，虽然处理器会对指令进行重排序，但是它会保证程序最终结果会和代码顺序执行结果相同，那么它靠什么保证的呢？再看下面一个例子：

```
int a = 10;    //语句1
int r = 2;    //语句2
a = a + 3;    //语句3
r = a*a;     //语句4
```

 　　这段代码有4个语句，那么可能的一个执行顺序是：

　　![执行顺序](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510095834.png)

　　那么可不可能是这个执行顺序呢： 语句2   语句1    语句4   语句3

　　不可能，因为处理器在进行重排序时是会考虑指令之间的数据依赖性，如果一个指令Instruction 2必须用到Instruction 1的结果，那么处理器会保证Instruction 1会在Instruction 2之前执行。

　　虽然重排序不会影响单个线程内程序执行的结果，但是多线程呢？下面看一个例子：
```
//线程1:
context = loadContext();   //语句1
inited = true;             //语句2
 
//线程2:
while(!inited ){
  sleep()
}
doSomethingwithconfig(context);
```
　上面代码中，由于语句1和语句2没有数据依赖性，因此可能会被重排序。假如发生了重排序，在线程1执行过程中先执行语句2，而此是线程2会以为初始化工作已经完成，那么就会跳出while循环，去执行doSomethingwithconfig(context)方法，而此时context并没有被初始化，就会导致程序出错。

 　　从上面可以看出，指令重排序不会影响单个线程的执行，但是会影响到线程并发执行的正确性。

　　也就是说，要想并发程序正确地执行，必须要保证原子性、可见性以及有序性。只要有一个没有被保证，就有可能会导致程序运行不正确。


# 2.volatile作用
### 2.1 防止重排序
从双重检查加锁（DCL)看指令重排序问题。

我们先看不加volatile的单例
```
public static Singleton instance;
public static Singleton getInstance(){
  if (instance == null)              //1
  {                                  //2
    synchronized(Singleton.class) {  //3
      if (instance == null)          //4
        instance = new Singleton();  //5
    }
  }
  return instance;
}

```
以上方式存在什么问题？ 
初看很完美，步骤3的同步操作保证了多线程的顺序性和可见性，是一个延迟加载的单例
但实际存在重排序问题。 正常构造对象的方式如下：
  ```
（1）分配内存空间。
（2）初始化对象。
（3）将内存空间的地址赋值给对应的引用。
```
第5步new操作，它可能会被编译器重排序成： 
```
（1）分配内存空间。
（2）将内存空间的地址赋值给对应的引用
（3）初始化对象instance
```
多线程环境下可能将一个未初始化的instance对象引用暴露出来，此时其他线程如果读到instance不是null，它就直接return instance了，这个instance并不是完整对象，很可能就崩溃了。

>JDK1.5增强了内存模型的功能。在本例中，因为JMM增强了volatile的语义，禁止编译器对volatile变量的读写进行重排序。对应于JMM的偏序原则(Happens-Before原则是JMM对多线程内存可见性的规则性描述):volatile变量规则：*对一个变量的写操作先行发生于后面对这个变量的读操作*

加volatile
```
public volatile static Singleton instance;
public static Singleton getInstance()
{
  if (instance == null)              //1
  {                                  //2
    synchronized(Singleton.class) {  //3
      if (instance == null)          //4
        instance = new Singleton();  //5
    }
  }
  return instance;
}
```
volatile根据jsr133规范,它可以禁止编译器对初始化instance对象的重排序，从而保证了创建对象的流程以及可见性

### 2.2 可见性
可见性问题主要指一个线程修改了共享变量值，而另一个线程却看不到。引起可见性问题的主要原因是每个线程拥有自己的一个高速缓存区——线程工作内存。volatile关键字能有效的解决这个问题，我们看下下面的例子，就可以知道其作用：

```
public class VisibilityTest {

    private static boolean lockStatus = false;

    public void changeLockStatus() {
        lockStatus = !lockStatus;
    }

    public void printResult(int i) {

        for (; ;) {
            try {
                TimeUnit.SECONDS.sleep(3);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            if (lockStatus) {
                System.err.println(Thread.currentThread().getName()+"-- lock = " + lockStatus);
            } else {
                System.out.println(Thread.currentThread().getName() +"-- lock = "+ lockStatus);
            }
        }
    }

    public static void main(String[] args) throws InterruptedException {

        VisibilityTest test = new VisibilityTest();
        RejectedExecutionHandler handler = new ThreadPoolExecutor.AbortPolicy();
        ThreadFactory threadFactory = new ThreadFactoryBuilder().setNameFormat("person-[%d]").build();
        ThreadPoolExecutor pool = new ThreadPoolExecutor(2, 8, 5L,
                TimeUnit.SECONDS, new SynchronousQueue<>(true),
                threadFactory, handler);

        CountDownLatch latch = new CountDownLatch(1);

        for (int i = 0; i < 5; i++) {
            final  int index = i;
            Runnable task = () -> {
                try {
                    latch.await();
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
                test.printResult(index);
            };
            pool.execute(task);
        }

        latch.countDown();
        System.out.println("start task");
        //改变锁状态观察线程可见性
        TimeUnit.SECONDS.sleep(6);
        pool.execute(test::changeLockStatus);

        TimeUnit.SECONDS.sleep(6);
        pool.execute(test::changeLockStatus);

        pool.shutdown();

    }

}
```
结果如下：运行的线程状态发生了变化
```
start task
person-[4]-- lock = false
person-[0]-- lock = false
person-[3]-- lock = false
person-[1]-- lock = false
person-[2]-- lock = false
person-[4]-- lock = false
person-[2]-- lock = false
person-[1]-- lock = false
person-[0]-- lock = false
person-[3]-- lock = false
person-[1]-- lock = true
person-[0]-- lock = true
person-[4]-- lock = true
person-[2]-- lock = true
person-[3]-- lock = true
person-[1]-- lock = true
person-[3]-- lock = true
person-[2]-- lock = true
person-[0]-- lock = true
person-[4]-- lock = true
person-[4]-- lock = false
person-[1]-- lock = false
person-[3]-- lock = false
person-[2]-- lock = false
person-[0]-- lock = false
```

### 2.3 原子性
　关于原子性的问题，volatile只能保证对单次读/写的原子性。这个问题可以看下JLS中的描述：
```
volatile只能保证可见性不能保证原子性，但用volatile修饰long和double可以保证其操作原子性。因为
long和double两种数据类型的操作可分为高32位和低32位两部分，因此普通的long或double类型读/写
可能不是原子的。因此，鼓励大家将共享的long和double变量设置为volatile类型，这样能保证任何情
况下对long和double的单次读/写操作都具有原子性。
```

# 3. volatile关键字原理
### 3.1 内存模型语义层面原理

　　**1、可见性实现：**

　　在前文中已经提及过，线程本身并不直接与主内存进行数据的交互，而是通过线程的工作内存来完成相应的操作。这也是导致线程间数据不可见的本质原因。因此要实现volatile变量的可见性，直接从这方面入手即可。对volatile变量的写操作与普通变量的主要区别有两点：

　　（1）修改volatile变量时会强制将修改后的值刷新的主内存中。
（2）修改volatile变量后会导致其他线程工作内存中对应的变量值失效。因此，再读取该变量值的时候就需要重新从读取主内存中的值。
通过这两个操作，就可以解决volatile变量的可见性问题。

　**　2、有序性实现：**

 　　在解释这个问题前，我们先来了解一下Java中的happen-before规则，JSR 133中对Happen-before的定义如下：
> 程序顺序规则：一个线程中的每个操作，happens- before 于该线程中的任意后续操作。
 监视器锁规则：对一个监视器的解锁，happens- before 于随后对这个监视器
的加锁。
> volatile 变量规则：对一个 volatile 域的写，happens- before 于任意后续对
这个 volatile 域的读。
 传递性：如果 A happens- before B，且 B happens- before C，那么 A happens- before C。

　**　3、内存屏障**

　　为了实现volatile可见性和happen-before的语义。JVM底层是通过一个叫做“内存屏障”的东西来完成。内存屏障，也叫做内存栅栏，是一组处理器指令，用于实现对内存操作的顺序限制。下面是完成上述规则所要求的内存屏障：
![volatile](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510100157.png)
在NO的地方会插入指令屏障来防止指令重排序
![volatile读.JPG](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510100222.png)

![volatile写.JPG](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510100250.png)


具体可参考前文[java内存模型](https://nicky-chen.github.io/2018/04/03/thread-jmm-happens-before/)




### 3.2 cpu层面原理

在了解volatile实现原理之前，我们先来看下与其实现原理相关的CPU术语与说明。表2-1
是CPU术语的定义。
![cpu术语](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510100406.png)

![image.png](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510103214.png)


volatile是如何来保证可见性的呢？让我们在X86处理器下通过工具获取JIT编译器生成的
汇编指令来查看对volatile进行写操作时，CPU会做什么事情。
Java代码如下。
```
instance = new Singleton(); // instance是volatile变量
```
转变成汇编代码，如下。
```
0x01a3de1d: movb $0×0,0×1104800(%esi);0x01a3de24: lock addl $0×0,(%esp);
```
有volatile变量修饰的共享变量进行写操作的时候会多出第二行汇编代码，通过查IA-32架
构软件开发者手册可知，Lock前缀的指令在多核处理器下会引发了两件事情 [1] 。
1）将当前处理器缓存行的数据写回到系统内存。
2）这个写回内存的操作会使在其他CPU里缓存了该内存地址的数据无效。

为了提高处理速度，处理器不直接和内存进行通信，而是先将系统内存的数据读到内部缓存（L1，L2或其他）后再进行操作，但操作完不知道何时会写到内存。如果对声明了volatile的变量进行写操作，JVM就会向处理器发送一条Lock前缀的指令，将这个变量所在缓存行的数据写回到系统内存。但是，就算写回到内存，如果其他处理器缓存的值还是旧的，再执行计算操作就会有问题。所以，在多处理器下，为了保证各个处理器的缓存是一致的，就会实现缓存一致性协议，每个处理器通过嗅探在总线上传播的数据来检查自己缓存的值是不是过期了，当处理器发现自己缓存行对应的内存地址被修改，就会将当前处理器的缓存行设置成无效状态，当处理器对这个数据进行修改操作的时候，会重新从系统内存中把数据读到处理器缓存里。

# 4. volatile的使用优化
著名的Java并发编程大师Doug lea在JDK 7的并发包里新增一个队列集合类Linked-
TransferQueue，它在使用volatile变量时，用一种追加字节的方式来优化队列出队和入队的性
能。LinkedTransferQueue的代码如下。
```
/** 队列中的头部节点 */
private transient f?inal PaddedAtomicReference<QNode> head;
/** 队列中的尾部节点 */
private transient f?inal PaddedAtomicReference<QNode> tail;
static f?inal class PaddedAtomicReference <T> extends AtomicReference T> {
// 使用很多4个字节的引用追加到64个字节
Object p0, p1, p2, p3, p4, p5, p6, p7, p8, p9, pa, pb, pc, pd, pe;
PaddedAtomicReference(T r) {
super(r);
}
}
public class AtomicReference <V> implements java.io.Serializable {
private volatile V value;
// 省略其他代码
｝

```
追加字节能优化性能？这种方式看起来很神奇，但如果深入理解处理器架构就能理解其中的奥秘。让我们先来看看LinkedTransferQueue这个类，它使用一个内部类类型来定义队列的头节点（head）和尾节点（tail），而这个内部类PaddedAtomicReference相对于父类AtomicReference只做了一件事情，就是将共享变量追加到64字节。我们可以来计算下，一个对象的引用占4个字节，它追加了15个变量（共占60个字节），再加上父类的value变量，一共64个字节。为什么追加64字节能够提高并发编程的效率呢？因为对于英特尔酷睿i7、酷睿、Atom和NetBurst，以及Core Solo和Pentium M处理器的L1、L2或L3缓存的高速缓存行是64个字节宽，不支持部分填充缓存行，这意味着，如果队列的头节点和尾节点都不足64字节的话，处理器会将它们都读到同一个高速缓存行中，在多处理器下每个处理器都会缓存同样的头、尾节点，当一个处理器试图修改头节点时，会将整个缓存行锁定，那么在缓存一致性机制的作用下，会导致其他处理器不能访问自己高速缓存中的尾节点，而队列的入队和出队操作则需要不停修改头节点和尾节点，所以在多处理器的情况下将会严重影响到队列的入队和出队效率。Doug lea使用追加到64字节的方式来填满高速缓冲区的缓存行，避免头节点和尾节点加载到同一个缓存行，使头、尾节点在修改时不会互相锁定。

那么是不是在使用volatile变量时都应该追加到64字节呢？不是的。在两种场景下不应该使用这种方式。缓存行非64字节宽的处理器。如P6系列和奔腾处理器，它们的L1和L2高速缓存行是32个字节宽。共享变量不会被频繁地写。因为使用追加字节的方式需要处理器读取更多的字节到高速缓冲区，这本身就会带来一定的性能消耗，如果共享变量不被频繁写的话，锁的几率也非常小，就没必要通过追加字节的方式来避免相互锁定。不过这种追加字节的方式在Java 7下可能不生效，因为Java 7变得更加智慧，它会淘汰或重新排列无用字段，需要使用其他追加字节的方式

不懂伪共享可以看这里 ---> [伪共享问题详解](http://ifeve.com/伪共享/)

# 5.应用场景
下面列举几个Java中使用volatile的几个场景。
**1.状态标记量***

```
volatile boolean flag = false;
 
while(!flag){
    doSomething();
}
 
public void setFlag() {
    flag = true;
}      
```
**2.double check**
```
class Singleton{
    private volatile static Singleton instance = null;
     
    private Singleton() {
         
    }
     
    public static Singleton getInstance() {
        if(instance==null) {
            synchronized (Singleton.class) {
                if(instance==null)
                    instance = new Singleton();
            }
        }
        return instance;
    }
}

```

# Reference
1.  深入理解Java虚拟机
2.  Java并发编程的艺术 - volatile的定义与实现原理
3.  [Java并发编程：volatile关键字解析](http://www.cnblogs.com/dolphin0520/p/3920373.html)
4.  [Java 并发编程：volatile的使用及其原理](http://www.cnblogs.com/paddix/p/5428507.html)

