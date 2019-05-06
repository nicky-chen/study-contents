Title: 并发基础之Condition(等待队列)
Date: 2018-08-09 22:32
Tags: 多线程
Category: concurrent
Slug: aqs-condition





#1 定义
**Condition**是在AQS中配合使用的`wait/nofity`线程通信协调工具类，我们可以称之为**等待队列**

Condition定义了等待/通知两种类型的方法，当前线程调用这些方法时，需要提前获取到Condition对象关联的锁。Condition对象是调用Lock对象的`newCondition()方法`创建出来的，换句话说，Condition是依赖Lock对象。

_Condition与Object中监视器方法不同点_
>condition可以有多个等待队列 monitor只有一个队列在对象头中
condition的等待可以自定义超时时间
conditon的signal 是唤醒等待队列头部的线程节点， Object的notify是随机唤醒
condition对象的属性对开发者透明


#2 Condition使用

**demo代码如下**
```
:::java
public class MyService {

    private Lock lock = new ReentrantLock();

    private Condition condition = lock.newCondition();

    public void await() {

        try {
            lock.lock();
            System.out.println("A");
            condition.await();
            System.out.println("B");
        } catch (InterruptedException e) {
            e.printStackTrace();
        }finally {
            lock.unlock();
            System.out.println("锁释放了");
        }
    }

    public void signal() {

        try {
            lock.lock();
            condition.signal();
            System.out.println("唤醒时间 ：" + System.currentTimeMillis());
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            lock.unlock();
        }
    }

}

public class ThreadB extends Thread {

    private MyService service;

    public ThreadB(MyService service) {
        this.service = service;
    }

    @Override public void run() {
        service.await();
    }
}

public class Run {

    public static void main(String[] args) throws InterruptedException {
        MyService service = new MyService();
        ThreadB b = new ThreadB(service);
        b.start();
        TimeUnit.SECONDS.sleep(3);
        service.signal();
    }

}
```
如示例所示，一般都会将Condition对象作为成员变量。当调用`await()`方法后，当前线程会释放锁并在此等待，而其他线程调用Condition对象的`signal()`方法，通知当前线程后，当前线程才从`await()`方法返回，并且在返回前已经获取了锁

控制台打印结果

```
A
唤醒时间 ：1533781721912
B
锁释放了
```

####2.1 等待队列信息

**方法说明**

![condition方法.PNG](https://upload-images.jianshu.io/upload_images/10175660-0ac4505401ef3aa2.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


获取一个Condition必须通过Lock的·newCondition()·方法。下面通过一个有界队列的示例来深入了解Condition的使用方式。

####2.2 阻塞队列
有界队列是一种特殊的队列，当队列为空时，队列的获取操作将会阻塞获取线程，直到队列中有新增元素，当队列已满时，队列的插入操作将会阻塞插入线程，直到队列出现“空位”，代码如下所示。

```
:::java
public class BoundedQueue<T> {

    private LinkedList<Object> items;

    private int size;

    private Lock lock = new ReentrantLock();

    //删除线程进等待队列
    private Condition notEmpty = lock.newCondition();

    //增加元素等待队列
    private Condition notFull = lock.newCondition();

    public BoundedQueue(int size) {
        this.size = size;
        items = new LinkedList<>();
    }

    // 添加一个元素，如果数组满，则添加线程进入等待状态，直到有"空位"
    public void add(T t) throws InterruptedException {
        lock.lock();
        try {
            while (size == items.size())
                notFull.await();
            //数组未满
            items.add(t);
            //删除线程的等待队列唤醒
            notEmpty.signal();
        } finally {
            lock.unlock();
        }
    }

    // 由头部删除一个元素，如果数组空，则删除线程进入等待状态，直到有新添加元素
    public T remove() throws InterruptedException {
        lock.lock();
        try {
            while (items.size() == 0)
                notEmpty.await();
            Object x = items.poll();
            notFull.signal();
            return (T) x;
        } finally {
            lock.unlock();
        }
    }
}
```
上述示例中，BoundedQueue通过`add(T t)`方法添加一个元素，通过`remove()`方法移出一个元素。

以添加方法为例:首先需要获得锁，目的是确保数组修改的可见性和排他性。当数组数量等于数组长度时，表示数组已满，则调用`notFull.await()`，当前线程随之释放锁并进入等待状态。如果数组数量不等于数组长度，表示数组未满，则添加元素到数组中，同时通知等待在notEmpty上的线程，数组中已经有新元素可以获取。

在添加和删除方法中使用while循环而非if判断，目的是防止过早或意外的通知，只有条件符合才能够退出循环。

#3 Condition源码分析

#### 3.1 等待队列

等待队列是一个FIFO的队列，在队列中的每个节点都包含了一个线程引用，该线程就是在Condition对象上等待的线程，如果一个线程调用了`Condition.await()`方法，那么该线程将会释放锁、构造成节点加入等待队列并进入等待状态。事实上，节点的定义复用了同步器中节点的定义，也就是说，同步队列和等待队列中节点类型都是同步器的静态内部类**AbstractQueuedSynchronizer.Node**。

一个Condition包含一个等待队列，Condition拥有首节点（ _firstWaiter_ ）和尾节点（ _lastWaiter_ ）。当前线程调用`Condition.await()`方法，将会以当前线程构造节点，并将节点从尾部加入等待队列，等待队列的基本结构如下所示

```
:::java
public class ConditionObject implements Condition, java.io.Serializable {
    private static final long serialVersionUID = 1173984872572414699L;
    
    //头节点
    private transient Node firstWaiter;
    //尾节点
    private transient Node lastWaiter;

    public ConditionObject() {
    }
    
}
```

![等待队列结构.PNG](https://upload-images.jianshu.io/upload_images/10175660-268967a778c5f20e.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

如图所示，Condition拥有首尾节点的引用，而新增节点只需要将原有的尾节点nextWaiter指向它，并且更新尾节点即可。**上述节点引用更新的过程并没有使用CAS保证，原因在于调用await()方法的线程必定是获取了锁的线程，也就是说该过程是由锁来保证线程安全的**。

在Object的监视器模型上，一个对象拥有一个同步队列和等待队列，而并发包中的Lock实现类拥有一个同步队列和多个等待队列

![同步队列和等待队列.PNG](https://upload-images.jianshu.io/upload_images/10175660-b44490bc23ffe40b.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

如上图所示，Condition的实现是同步器的内部类，因此每个Condition实例都能够访问同步器提供的方法，相当于每个Condition都拥有所属同步器的引用。


####3.2 await等待

调用Condition的`await()`方法（或者以await开头的方法），会使当前线程进入等待队列并释放锁，同时线程状态变为等待状态。当从`await()`方法返回时，当前线程一定获取了Condition相关联的锁。

如果从队列（同步队列和等待队列）的角度看await()方法，当调用await()方法时，相当于同步队列的首节点（获取了锁的节点）移动到Condition的等待队列中。

**Condition的await()方法**

```
:::java
public final void await() throws InterruptedException {
            if (Thread.interrupted()) //如果线程中断则直接异常
                throw new InterruptedException();
    //包装node节点信息，将它添加到等待队列（单向链表）的尾部
            Node node = addConditionWaiter();
    //释放当前锁
            int savedState = fullyRelease(node);
            int interruptMode = 0;
//判断当前线程的节点是否还在同步队列中，如果节点为Node.CONDITION 状态，则阻塞当前线程，否则从同步队列尾部开始查找，是否存在该节点
            while (!isOnSyncQueue(node)) {
                LockSupport.park(this);
    ////如果已经中断了，则退出
                if ((interruptMode = checkInterruptWhileWaiting(node)) != 0)
                    break;
            }
      ////被唤醒后，重新加入到同步队列队尾竞争获取锁，如果竞争不到则会沉睡，等待唤醒重新开始竞争。
            if (acquireQueued(node, savedState) && interruptMode != THROW_IE)
                interruptMode = REINTERRUPT;
            if (node.nextWaiter != null) // clean up if cancelled
                unlinkCancelledWaiters(); //等待队列中删除非Conditon状态的节点
            if (interruptMode != 0)
                reportInterruptAfterWait(interruptMode);
        }
```
调用该方法的线程成功获取了锁的线程，也就是同步队列中的首节点，该方法会将当前线程构造成节点并加入等待队列中，（ _因为已经获取了同步状态，所以无需通过cas,在队列尾部添加等待节点_ ）然后释放同步状态，唤醒同步队列中的后继节点，然后当前线程会进入等待状态。

当等待队列中的节点被唤醒，则唤醒节点的线程开始尝试获取同步状态。如果不是通过其他线程调用`Condition.signal()`方法唤醒，而是对等待线程进行中断，则会抛出InterruptedException。

如果从队列的角度去看，当前线程加入Condition的等待队列，如图所示，同步队列的首节点并不会直接加入等待队列，而是通过`addConditionWaiter()`方法把当前线程构造成一个新的节点并将其加入等待队列中

![将当前节点加入等待队列.PNG](https://upload-images.jianshu.io/upload_images/10175660-99594d90cf500323.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

####3.3 通知

调用Condition的`signal()`方法，将会唤醒在等待队列中等待时间最长的节点（首节点），在唤醒节点之前，会将节点移到同步队列末尾。

**signal方法** 
```
:::java
   public final void signal() {
    //判断是否是独占锁
            if (!isHeldExclusively())
                throw new IllegalMonitorStateException();
            Node first = firstWaiter; //获取等待队列ConditionObject中的头节点
            if (first != null)
                doSignal(first); //如果节点不为空，唤醒操作
        }


private void doSignal(Node first) {
            do {
    //如果头节点的后继节点设置为头节点，并判断是否为空
                if ( (firstWaiter = first.nextWaiter) == null)
                    lastWaiter = null;
    //将头节点移出等待队列
                first.nextWaiter = null;
            } while (!transferForSignal(first) && 
//如果等待队列头节点不为空且修改头节点状态为0成功
                     (first = firstWaiter) != null);
        }

    //将老的头结点，加入到AQS的等待队列中
final boolean transferForSignal(Node node) {
          // cas设置等待状态失败为false
        if (!compareAndSetWaitStatus(node, Node.CONDITION, 0))
            return false;

    //cas设置成功则将节点加入到同步队列尾部，返回node节点前一节点
        Node p = enq(node);
        int ws = p.waitStatus;
    //如果结点p的状态为cancel 或者修改waitStatus失败，则直接唤醒
        if (ws > 0 || !compareAndSetWaitStatus(p, ws, Node.SIGNAL))
            LockSupport.unpark(node.thread);
        return true; //cas成功返回true
    }
```
调用signal方法的前置条件是当前线程必须获取了锁，可以看到`signal()`方法进行了`isHeldExclusively()`检查，也就是当前线程必须是获取了锁的线程。接着获取等待队列的首节点，将其移动到同步队列并使用LockSupport唤醒节点中的线程。

节点从等待队列移动到同步队列的过程如下图所示

![唤醒过程](https://upload-images.jianshu.io/upload_images/10175660-d8083a4de28e82ef.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

* 通过调用同步器的`enq(Node node)`方法，等待队列中的头节点线程安全地移动到同步队列。
* 当节点移动到同步队列后，当前线程再使用LockSupport唤醒该节点的线程。
* 被唤醒后的线程，将从`await()`方法中的while循环中退出（`isOnSyncQueue(Node node)`方法返回true，节点已经在同步队列中），进而调用同步器的`acquireQueued()`方法加入到获取同步状态的竞争中。
* 成功获取同步状态之后，被唤醒的线程将从先前调用的`await()`方法返回，此时该线程已经成功地获取了锁。

**signalAll**
```
:::java
 public final void signalAll() {
            if (!isHeldExclusively())
                throw new IllegalMonitorStateException();
            Node first = firstWaiter;
            if (first != null)
                doSignalAll(first);
        }

  private void doSignalAll(Node first) {
            lastWaiter = firstWaiter = null;
            do {
                Node next = first.nextWaiter;
                first.nextWaiter = null;
                transferForSignal(first);
                first = next;
            } while (first != null);
        }
```
不难看出Condition的`signalAll()`方法，相当于对等待队列中的每个节点均执行一次`signal()`方法，效果就是将等待队列中所有节点全部移动到同步队列中，并唤醒每个节点的线程。


#Reference
java并发编程艺术
