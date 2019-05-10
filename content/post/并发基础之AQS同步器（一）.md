
---
title: "并发基础之AQS同步器（一）"
date: 2018-07-31T11:18:15+08:00
weight: 70
slug: aqs_chapter01
tags: ["多线程"]
categories: ["concurrent"]
author: "nicky_chin"
comments: true
share: true
draft: false
--


# 1 AQS同步器

队列同步器**AbstractQueuedSynchronizer**，是用来构建锁或者其他同步组件的基础框架，它使用了一个int成员变量表示同步状态，通过内置的FIFO队列来完成资源获取线程的排队工作，并发包的作者（Doug Lea）期望它能够成为实现大部分同步需求的基础。

同步器的主要使用方式是继承，子类通过继承同步器并实现它的抽象方法来管理同步状态，在抽象方法的实现过程中免不了要对同步状态进行更改，这时就需要使用同步器提供的3个方法
>getState()
setState(int newState)
compareAndSetState(int expect,int update)

来进行操作，因为它们能够保证状态的改变是安全的。这样就可以方便实现不同类型的同步组件（`ReentrantLock、ReentrantReadWriteLock和CountDownLatch`等）

**核心操作方式：**

场景1：阻塞直到获取指定资源数

场景2：可中断限时等待直到获取指定资源数

场景3：直接尝试获取指定资源数

场景4：释放指定资源数

上述四个步骤又都可以分为 _共享（share）操作和独占（exclusive）_ 操作两种，如果AQS设计的足够好，则所有的容器类只需要控制资源数目、获取的资源量和释放的资源量即可

下图（独占和共享的方法调用）：

![LOCK](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510113609.png)

`acquire`用来表示是获取资源数的操作，而`release`表示用来释放资源数的操作，不带`Shared`表示是独占的操作。如果我们没有实现红色圆角矩形框的方法却间接调用了，将会抛出著名的`UnsupportedOperationException`异常。


# 2 队列同步器的接口

同步器的设计是基于模板方法模式
模板方法将会调用使用者重写的方法
重写同步器指定的方法时，需要使用同步器提供的如下3个方法来访问或修改同步状态。
* getState()：获取当前同步状态。
* setState(int newState)：设置当前同步状态。
* compareAndSetState(int expect,int update)：使用CAS设置当前状态，该方法能够保证状态设置的原子性。

 独占锁操作方法说明如下：

![exclusiveLock](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510113638.png)

共享锁操作方法如下：

![方法2.PNG](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510113703.png)


同步器提供的模板方法基本上分为3类：
>独占式获取与释放同步状态
共享式获取与释放
同步状态和查询同步队列中的等待线程情况

自定义同步组件将使用同步器提供的模板方法来实现自己的同步语义。只有掌握了同步器的工作原理才能更加深入地理解并发包中其他的并发组件


### 自定义同步组件

```
public class Mutex implements Lock {

    public static void main(String[] args) {

        Mutex mutex = new Mutex();
        CountDownLatch latch = new CountDownLatch(1);
        Test test = new Test();
        ExecutorService pool = Executors.newFixedThreadPool(10);

        for (int i = 0; i < 10; i++) {
            Runnable runnable = () -> {
                try {
                    latch.await();
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
                try {
                    mutex.tryLock(1, TimeUnit.SECONDS);
                    System.out.println(test.a);
                    test.add();
                } catch (InterruptedException e) {
                    e.printStackTrace();
                } finally {
                    mutex.unlock();
                }
            };
            pool.execute(runnable);
        }

        latch.countDown();


        pool.shutdown();




    }
    


    // 静态内部类，自定义同步器
    private static class Sync extends AbstractQueuedSynchronizer {
        // 是否处于占用状态
        protected boolean isHeldExclusively() {
            return getState() == 1;
        }
        // 当状态为0的时候获取锁
        public boolean tryAcquire(int acquires) {
            if (compareAndSetState(0, 1)) {
                setExclusiveOwnerThread(Thread.currentThread());
                return true;
            }
            return false;
        }
        // 释放锁，将状态设置为0
        protected boolean tryRelease(int releases) {
            if (getState() == 0) throw new IllegalMonitorStateException();
            setExclusiveOwnerThread(null);
            setState(0);
            return true;
        }
        // 返回一个Condition，每个condition都包含了一个condition队列
        Condition newCondition() { return new ConditionObject(); }
    }

    // 仅需要将操作代理到Sync上即可
    private final Sync sync = new Sync();

    public void lock() {
        sync.acquire(1);
    }

    public boolean tryLock() {
        return sync.tryAcquire(1);
    }

    public void unlock() {
        sync.release(1);
    }

    public Condition newCondition() {
        return sync.newCondition();
    }

    public boolean isLocked() {
        return sync.isHeldExclusively();
    }

    public boolean hasQueuedThreads() {
        return sync.hasQueuedThreads();
    }

    public void lockInterruptibly() throws InterruptedException {
        sync.acquireInterruptibly(1);
    }

    public boolean tryLock(long timeout, TimeUnit unit) throws InterruptedException {
        return sync.tryAcquireNanos(1, unit.toNanos(timeout));
    }
}
```
通过静态内部类继承AQS的方式，重写独占锁的方法，自定义同步器组件
然后启动10个线程测试，发现add方法按正常顺序递增

信号量实现
```
:::java
public class SharedLock implements Lock {

    public static void main(String[] args) {
        SharedLock lock = new SharedLock();
        Test test = new Test();
        ExecutorService pool = Executors.newFixedThreadPool(11);
        CountDownLatch latch = new CountDownLatch(1);

        for (int i = 0; i < 11; i++) {
            Runnable runnable = () -> {
                try {
                    latch.await();
                } catch (InterruptedException e) {
                    e.printStackTrace();

                }
                try {
                    lock.tryLock(1, TimeUnit.SECONDS);
                    System.out.println(test.a);
                    test.add();
                    System.err.println(test.a);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                } finally {
                    lock.unlock();
                }
            };
            pool.execute(runnable);

        }
        latch.countDown();


        pool.shutdown();



    }



    private final Sync sync = new Sync(5);


    private static class Sync extends AbstractQueuedSynchronizer{

        public Sync(int lockNum) {
            if (lockNum < 0) {
                throw new IllegalArgumentException("lockNum gt 0");
            }
            setState(lockNum);

        }

        public int getLockNum() {

            return getState();

        }


        @Override
        protected final int tryAcquireShared(int lockNum) {

            for (; ; ) {

                int available = getState();
                int remaining = available - lockNum;
                if (remaining < 0) {
                    return remaining;
                }
                if (compareAndSetState(available, remaining)){
                      return remaining;
                }

            }

        }



        protected final boolean tryReleaseShared(int lockNum) {

            for (;;) {

                int current = getState();
                int next = current + lockNum;
                if (compareAndSetState(current, next))
                    return true;

            }
        }

    }


    @Override
    public void lock() {
        sync.acquireShared(1);
    }

    @Override
    public void lockInterruptibly() throws InterruptedException {
        sync.acquireSharedInterruptibly(1);
    }

    @Override
    public boolean tryLock() {
        //共享式获取同步状态 大于等于0表示成功
        return sync.tryAcquireShared(1) >= 0;
    }

    @Override
    public boolean tryLock(long time, TimeUnit unit) throws InterruptedException {
        return sync.tryAcquireSharedNanos(1, unit.toNanos(time));
    }

    @Override
    public void unlock() {
        sync.releaseShared(1);
    }

    @Override
    public Condition newCondition() {
        return null;
    }
}
```
通过自旋和原子性操作的方式加锁解锁




# 3 CLH同步队列

**CLH(Craig, Landin, and Hagersten)锁**，简单的说，它使用队列的方式来解决n个线程来争夺m把锁的问题，每当一个新的线程需要获取锁，为其创建一个节点并放到队尾，如果该线程是队列中的第一个节点，则节点的locked设置成false，如果它不是队列的第一个节点，则它的节点的prev指向原来的队尾节点，并不断自旋查看prev指向节点的locked属性，如果该值变为false，表示轮到它来尝试获取锁了，如果获取成功并最终用完释放后，则将自己的locked设置成false，如果获取失败，locked值不变，还是true，并不断尝试获取锁。MSC也是可扩展、高性能的自旋锁，它和CLH不同的是，它是对自己节点的locked属性进行自旋，这意味着prev节点释放锁后，需要去主动改变它的后继next节点的locked的状态。对比可以看出，CLH用的是隐式的队列，因为节点不需要关心它的prev节点是谁，关心的只是prev节点的locked属性，而MCS需要主动去通知next节点的locked属性，所以它的本质确实是队列。

具体的CLH和MCS细节可以看：[自旋锁、排队自旋锁、MCS锁、CLH锁](http://coderbee.net/index.php/concurrent/20131115/577/comment-page-1)

AQS参考了CLH锁的设计,但AQS没有采用CLH中的自旋来查看前驱（prev）节点的状态，因为在多核处理器时代，对volatile变量的自旋代价比较高

# Reference
Java并发编程的艺术
