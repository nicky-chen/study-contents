
---
title: "并发基础之AQS同步器（二）"
date: 2018-08-04T11:18:15+08:00
weight: 70
slug: aqs_chapter02
tags: ["多线程"]
categories: ["concurrent"]
author: "nicky_chin"
comments: true
share: true
draft: false
---


在AQS同步器组件原理分析前，我们需要了解同步队列这个概念，了解同步队列中节点的入队和出队的流程，CHL同步队列的由来，可以参考我之前的文章：
[并发基础之AQS同步器（一）](https://www.jianshu.com/p/afce44b21d77)


# 1 同步队列

同步器依赖内部的同步队列（一个FIFO双向队列）来完成同步状态的管理，当前线程获取同步状态失败时，同步器会将当前线程以及等待状态等信息构造成为一个节点（Node）并将其加入同步队列，同时会阻塞当前线程，当同步状态释放时，会把首节点中的线程唤醒，使其再次尝试获取同步状态

FIFO队列`Node`对象的具体实现如下：

```
static final class Node {
        static final Node SHARED = new Node();
        static final Node EXCLUSIVE = null;
        static final int CANCELLED =  1;
        static final int SIGNAL    = -1;
        static final int CONDITION = -2;
        static final int PROPAGATE = -3;
        volatile int waitStatus;
        volatile Node prev;
        volatile Node next;
        volatile Thread thread;
        Node nextWaiter;
        .final boolean isShared() {
        return nextWaiter == SHARED;
    }

    final Node predecessor() throws NullPointerException {
        Node p = prev;
        if (p == null)
            throw new NullPointerException();
        else
            return p;
    }

    Node() {
    }

    Node(Thread thread, Node mode) {
        this.nextWaiter = mode;
        this.thread = thread;
    }

    Node(Thread thread, int waitStatus) {
        this.waitStatus = waitStatus;
        this.thread = thread;
    }
}
```

**节点属性类型与名称以及描述**

![属性名称](https://upload-images.jianshu.io/upload_images/10175660-50eaea466097ee17.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)
 
>volatile int waitStatus;
        volatile Node prev;
        volatile Node next;
        volatile Thread thread;
     
上述的几个属性都使用了volatile语义，是为了保证内存的可见性，在配合**CAS**的使用过程中，能够获取到该属性的变化，可以说 volatile + CAS 组合是实现同步器的基础

同步队列结构图如下：

![同步队列](https://upload-images.jianshu.io/upload_images/10175660-4458697e9594185c.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


同步器包含了两个节点类型的引用，一个指向头节点，而另一个指向尾节点。

当一个线程成功地获取了同步状态（或者锁），其他线程将无法获取到同步状态，转而被构造成为节点并加入到同步队列中，而这个加入队列的过程必须要保证线程安全，因此同步器提供了一个基于CAS的设置尾节点的方法：`compareAndSetTail(Node expect,Nodeupdate)`，它需要传递当前线程“认为”的尾节点和当前节点，只有设置成功后，当前节点才正式与之前的尾节点建立关联。

### 1.1 入队操作

![入队操作](https://upload-images.jianshu.io/upload_images/10175660-e883018e54906887.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

### 1.2 获取同步状态

![设置首节点](https://upload-images.jianshu.io/upload_images/10175660-f95a12ea2655d585.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


同步队列遵循FIFO，首节点是获取同步状态成功的节点，首节点的线程在释放同步状态时，将会唤醒后继节点，而后继节点将会在获取同步状态成功时将自己设置为首节点由于只有一个线程能够成功获取到同步状态，因此设置头节点的方法并不需要使用CAS来保证,后面代码中会具体分析


# 2 独占锁实现
### 2.1 同步状态获取


同步器锁获取方法在`acquire`方法中,代码如下：
```
:::java
//同步状态获取、节点构造、加入同步队列以及在同步队列中自旋
    public final void acquire(int arg) {
        if (!tryAcquire(arg) &&
            acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
            selfInterrupt();
    }
```
其主要逻辑是：
* 1 首先调用自定义的`tryAcquire(int arg)`方法，获取同步状态
* 2 如果同步状态获取失败，则构造同步节点,并通过`addWaiter(Node node)`方法将该节点加入到同步队列的尾部
* 3 调用`acquireQueued(Node node,int arg)`方法，使得该节点以“死循环”的方式自旋获取同步状态。如果获取不到则阻塞节点中的线程，_而被阻塞线程的唤醒主要依靠前驱节点的出队或阻塞线程被中断来实现_

自定义实现的`tryAcquire(int arg)`方法如下

```
:::java
  public boolean tryAcquire(int acquires) {
            if (compareAndSetState(0, 1)) {
                setExclusiveOwnerThread(Thread.currentThread());
                return true;
            }
            return false;
        }
```
通过CAS来获取同步状态，如果获取成功，则将`state`的的状态标记为1，并且将AQS对象中的独占拥有线程属性`exclusiveOwnerThread`的引用指向当前线程。如果获取失败，则直接返回false


如果获取锁失败，节点的构造以及加入同步队列，方法如下

```
:::java
  private Node addWaiter(Node mode) {
    //构建同步队列节点
        Node node = new Node(Thread.currentThread(), mode);
        // Try the fast path of enq; backup to full enq on failure
        Node pred = tail;
      //如果当前同步队列尾节点不为空，即有等待状态的节点
        if (pred != null) {
            node.prev = pred; //将当前要加入节点的前驱节点指向同步队列的尾节点
            if (compareAndSetTail(pred, node)) {//通过cas尝试将当前节点加入到同步队列尾部
                pred.next = node;  //cas成功 则将同步队列的后继节点指向当前加入同步节点
                return node;
            }
        }
    //如果加入同步队列失败等其他状况，则如果 enq方法
        enq(node);
        return node;
    }

private Node enq(final Node node) {
    //死循环自旋的方式将同步节点加入到同步队列操作
        for (;;) {
            Node t = tail;
    //如果同步队列队尾为空，则初始化同步队列
            if (t == null) { // Must initialize
                if (compareAndSetHead(new Node()))
                    tail = head;  //对头队尾都是同一对象，int waitStatus的等待状态为0
            } else {
//如果同步队列不为空，则cas将当前节点加入到同步器队尾
                node.prev = t;
                if (compareAndSetTail(t, node)) {
                    t.next = node;
                    return t;
                }
            }
        }
    }
```
上述代码通过使用`compareAndSetTail(Node expect,Node update)`方法来确保节点能够被线程安全添加。

如果使用普通的LinkedList来维护节点之间的关系，多个线程由于调用`tryAcquire(int arg)`方法获取同步状态失败而并发地被添加到LinkedList时，LinkedList将难以保证Node的正确添加，最终的结果可能是节点的数量有偏差，而且顺序也是混乱的。

在`enq(final Node node)`方法中，同步器通过“死循环”来保证节点的正确添加，在“死循环”中只有通过CAS将节点设置成为尾节点之后，当前线程才能从该方法返回，否则，当前线程不断地尝试设置。


**同步队列中获取同步状态过程**

节点进入同步队列之后，就进入了一个自旋的过程，当条件满足，获取到了同步状态，就可以从这个自旋过程中退出，否则依旧留在这个自旋过程中 
 _（并会阻塞节点的线程）_  

具体方法如下:

```
:::java
 final boolean acquireQueued(final Node node, int arg) {
        boolean failed = true;
        try {
            boolean interrupted = false;
    //自旋获取同步状态
            for (;;) {
    //获取当前自旋节点的前驱节点
                final Node p = node.predecessor();
    //如果前驱节点是同步队列的头节点，则尝试获取同步状态
                if (p == head && tryAcquire(arg)) {
                    setHead(node); //获取同步状态成功，将头节点设置为当前节点，并将node.pre设置为null
                    p.next = null; // help GC
                    failed = false;
                    return interrupted;
                }
    //获取锁失败后是否需要阻塞线程，需要则修改线程状态
                if (shouldParkAfterFailedAcquire(p, node) &&
                    parkAndCheckInterrupt())
                    interrupted = true;
            }
        } finally {
        //如果当前节点中断，则取消获取同步状态，并将waitStatus 设置为Node.CANCELLED 
            if (failed)
                cancelAcquire(node);
        }
    }

//该方法主要通过前驱节点判断当前线程是否应该被阻塞
 private static boolean shouldParkAfterFailedAcquire(Node pred, Node node) {
    //获取前驱节点的等待状态
        int ws = pred.waitStatus;
        if (ws == Node.SIGNAL)
            /*
             * 如果状态是signal,表示线程处于blocked状态，返回true
             */
            return true;
        if (ws > 0) {
           //前驱节点状态 > 0 ，则为Cancelled,表明该节点已经超时或被中断，需要从同步队列中跳过
            do {//循环跳过逻辑
                node.prev = pred = pred.prev;
            } while (pred.waitStatus > 0);
            pred.next = node; //找到waitStatus<=0的节点与node节点前后链接
        } else {
    //如果前驱节点状态为Condition、propagate （0， -3）,则表明节点需要signal状态，而不是阻塞，
    //则重试CAS操作确认该节点在阻塞前未获取到同步状态
            compareAndSetWaitStatus(pred, ws, Node.SIGNAL);
        }
        return false;
    }
```

在`acquireQueued(final Node node,int arg)`方法中，当前线程在“死循环”中尝试获取同步状态，而只有前驱节点是头节点才能够尝试获取同步状态，这是为什么？原因有两个，如下。
* 1 头节点是成功获取到同步状态的节点，而头节点的线程释放了之后，将会唤醒其后继节点，后继节点的线程被唤醒后需要检查自己的前驱节点是否是头节点。
* 2 维护同步队列的FIFO原则。该方法中，节点自旋获取同步状态的行为如图所示:

![同步状态](https://upload-images.jianshu.io/upload_images/10175660-9435ca33949683ec.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

独占式同步状态获取流程，`acquire(int arg)`方法调用流程，如图：

![独占式获取锁流程](https://upload-images.jianshu.io/upload_images/10175660-4e42520e216e4c64.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

前驱节点为头节点且能够获取同步状态的判断条件和线程进入等待状态是获取同步状态的自旋过程。当同步状态获取成功之后，当前线程从`acquire(int arg)`方法返回，如果对于锁这种并发组件而言，代表着当前线程获取了锁。

### 2.2 同步状态释放

当前线程获取同步状态并执行了相应逻辑之后，就需要释放同步状态，使得后续节点能够继续获取同步状态。通过调用同步器的`release(int arg)`方法可以释放同步状态，该方法在释放了同步状态之后，会唤醒其后继节点（进而使后继节点重新尝试获取同步状态）。该方法如下:

```
:::java
 public final boolean release(int arg) {
        if (tryRelease(arg)) {
            Node h = head;
            if (h != null && h.waitStatus != 0)
                unparkSuccessor(h);
            return true;
        }
        return false;
    }

     protected boolean tryRelease(int releases) {
            if (getState() == 0) throw new IllegalMonitorStateException();
            setExclusiveOwnerThread(null);
            setState(0);
            return true;
        }

//唤醒后继节点
private void unparkSuccessor(Node node) {
        //当前节点状态
        int ws = node.waitStatus;
        //当前状态 < 0 则设置为 0
        if (ws < 0)
            compareAndSetWaitStatus(node, ws, 0);

        //当前节点的后继节点
        Node s = node.next;
        //后继节点为null或者其状态 > 0 (超时或者被中断了)
        if (s == null || s.waitStatus > 0) {
            s = null;
            //从tail节点来找可用节点
            for (Node t = tail; t != null && t != node; t = t.prev)
                if (t.waitStatus <= 0)
                    s = t;
        }
        //唤醒后继节点
        if (s != null)
            LockSupport.unpark(s.thread);
    }
```
通过自定义的`tryRelease(int releases) `方法，当**state**变成0的时候表示释放成功，同时唤醒通过`unparkSuccessor(Node node)` 方法唤醒后继节点

### 2.3 独占式获取响应中断

AQS提供了`acquire(int arg)`方法以独占式获取同步状态，但是该方法对中断不响应，对线程进行中断操作后，该线程会依然位于CLH同步队列中等待着获取同步状态。为了响应中断，AQS提供了`acquireInterruptibly(int arg)`方法，该方法在等待获取同步状态时，如果当前线程被中断了，会立刻响应中断抛出异常InterruptedException。
```
:::java
  public final void acquireInterruptibly(int arg)
            throws InterruptedException {
        if (Thread.interrupted())
            throw new InterruptedException();
        if (!tryAcquire(arg))
            doAcquireInterruptibly(arg);
    }
```
**private void doAcquireInterruptibly(int arg)**方法和**final boolean acquireQueued(final Node node, int arg)**方法基本类似,所以这部分分析省略


### 2.4 独占式超时获取

`tryAcquireNanos(int arg,long nanos)`该方法为`acquireInterruptibly`方法的进一步增强，它除了响应中断外，还有超时控制。即如果当前线程没有在指定时间内获取同步状态，则会返回false，否则返回true。针对超时获取，主要需要计算出需要睡眠的时间间隔_nanosTimeout_  , 方法如下：
```
:::java
  public final boolean tryAcquireNanos(int arg, long nanosTimeout)
            throws InterruptedException {
        if (Thread.interrupted())
            throw new InterruptedException();
        return tryAcquire(arg) ||
            doAcquireNanos(arg, nanosTimeout);
    }

    //获取超时逻辑
 private boolean doAcquireNanos(int arg, long nanosTimeout)
            throws InterruptedException {
        if (nanosTimeout <= 0L) //参数校验
            return false;
    //  获取超时的纳秒值
        final long deadline = System.nanoTime() + nanosTimeout;
        final Node node = addWaiter(Node.EXCLUSIVE);//构造节点
        boolean failed = true;
        try {//自旋获取同步状态
            for (;;) {
                final Node p = node.predecessor();
                if (p == head && tryAcquire(arg)) {
                    setHead(node);
                    p.next = null; // help GC
                    failed = false;
                    return true;
                }
    //在正常获取同步状态的逻辑上加入超时校验
                nanosTimeout = deadline - System.nanoTime();
                if (nanosTimeout <= 0L)
                    return false;
                if (shouldParkAfterFailedAcquire(p, node) &&
                    nanosTimeout > spinForTimeoutThreshold)
                    LockSupport.parkNanos(this, nanosTimeout);
                if (Thread.interrupted())
                    throw new InterruptedException();
            }
        } finally {
            if (failed)
                cancelAcquire(node);
        }
    }
```
方法在自旋过程中，当节点的前驱节点为头节点时尝试获取同步状态，如果获取成功则从该方法返回，这个过程和独占式同步获取的过程类似。

但是在同步状态获取失败的处理上有所不同。如果当前线程获取同步状态失败，则判断是否超时（nanosTimeout小于等于0表示已经超时），如果没有超时，重新计算超时间隔nanosTimeout，然后使当前线程等待nanosTimeout纳秒（当已到设置的超时时间，该线程会从`LockSupport.parkNanos(Objectblocker,long nanos)`方法返回）。

如果nanosTimeout小于等于**spinForTimeoutThreshold（1000纳秒）**时，将不会使该线程进行超时等待，而是进入快速的自旋过程。原因在于，非常短的超时等待无法做到十分精确，如果这时再进行超时等待，相反会让nanosTimeout的超时从整体上表现得反而不精确。因此，在超时非常短的场景下，同步器会进入无条件的快速自旋。

**独占式超时获取同步状态流程如图**

![超时流程图](https://upload-images.jianshu.io/upload_images/10175660-6ee22896a8f7079b.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


# 3 共享锁实现
共享式获取与独占式获取最主要的区别在于同一时刻能否有多个线程同时获取到同步状态。

### 3.1 共享式同步状态获取

AQS提供`acquireShared(int arg)`方法共享式获取同步状态：
```
:::java
 public final void acquireShared(int arg) {
        if (tryAcquireShared(arg) < 0)
    //获取失败，自旋获取同步状态
            doAcquireShared(arg);
    }
```
首先判断自定义的`tryAcquireShared(arg)`是否获取到同步状态，如果获取失败，则进入`doAcquireShared(arg)`方法

```
:::java
 private void doAcquireShared(int arg) {
    //构造共享节点
        final Node node = addWaiter(Node.SHARED);
        boolean failed = true;
        try {
            boolean interrupted = false;
    //自旋方式获取同步状态
            for (;;) {
    // 获取节点的前驱节点
                final Node p = node.predecessor();
                if (p == head) {//如果前驱节点是同步队列头节点则尝试获取同步状态
                    int r = tryAcquireShared(arg);
                    if (r >= 0) {//获取同步状态成功
                        setHeadAndPropagate(node, r); //同步队列头设置为当前节点
                        p.next = null; // help GC
                        if (interrupted)
                            selfInterrupt();
                        failed = false;
                        return;
                    }
                }
    //获取失败后是否需要阻塞线程
                if (shouldParkAfterFailedAcquire(p, node) &&
                    parkAndCheckInterrupt())
                    interrupted = true;
            }
        } finally {
            if (failed) //如果当前节点中断异常则从同步队列中移除
                cancelAcquire(node);
        }
    }
```
在`acquireShared(int arg)`方法中，同步器调用`tryAcquireShared(int arg)`方法尝试获取同步状态，tryAcquireShared(int arg)方法返回值为int类型，当返回值大于等于0时，表示能够获取到同步状态。

因此，在共享式获取的自旋过程中，成功获取到同步状态并退出自旋的条件就是`tryAcquireShared(int arg)`方法返回值大于等于0。可以看到，在`doAcquireShared(int arg)`方法的自旋过程中，如果当前节点的前驱为头节点时，尝试获取同步状态，如果返回值大于等于0，表示该次获取同步状态成功并从自旋过程中退出。


### 3.2 共享式同步状态释放

获取同步状态后，需要调用`release(int arg)`方法释放同步状态，方法如下：
```
:::java
 public final boolean releaseShared(int arg) {
        if (tryReleaseShared(arg)) {//自定义ryReleaseShared方法中释放同步状态成功
            doReleaseShared();
            return true;
        }
        return false;
    }

private void doReleaseShared() {
        for (;;) {
            Node h = head;
            if (h != null && h != tail) {
                int ws = h.waitStatus;
                if (ws == Node.SIGNAL) {
                    if (!compareAndSetWaitStatus(h, Node.SIGNAL, 0))
                        continue;            // loop to recheck cases
                    unparkSuccessor(h); //设置状态成功唤醒后继节点
                }
                else if (ws == 0 &&
                         !compareAndSetWaitStatus(h, 0, Node.PROPAGATE))
                    continue;                // loop on failed CAS
            }
            if (h == head)                   // loop if head changed
                break;
        }
    }
```
该方法在释放同步状态之后，将会唤醒后续处于等待状态的节点。对于能够支持多个线程同时访问的并发组件（比如Semaphore），它和独占式主要区别在于`tryReleaseShared(int arg)`方法必须确保同步状态（或者资源数）线程安全释放，一般是通过循环和CAS来保证的，因为释放同步状态的操作会同时来自多个线程。

### 3.3 中断和超时
超时中断的方法和独占锁的方法类似，省略

#Reference
java并发编程艺术
