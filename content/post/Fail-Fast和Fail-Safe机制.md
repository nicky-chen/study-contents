
---
title: Fail-Fast和Fail-Safe机制
date: 2018-06-02T11:18:15+08:00
weight: 70
slug: fail-fast-safe
tags: ["基础"]
categories: ["java-base"]
author: "nicky_chin"
comments: true
share: true
draft: false
---

# 1 Fail-Fast 

### 1.1 fail-fast定义
fail-fast 机制是java集合(Collection)中的一种错误机制。当多个线程对同一个集合的内容进行操作时，就可能会产生fail-fast事件
例如：当某一个线程A通过iterator去遍历某集合的过程中，若该集合的内容被其他线程所改变了；那么线程A访问集合时，就会抛出ConcurrentModificationException异常，产生fail-fast事件

### 1.2 Iterator与fast-fail机制
**1.2.1 Iterator的好处**
java源码中迭代器模式主要用于集合的迭代，只要实现了Collection接口就可以使用迭代器去遍历获取元素，这样我们不需要了解遍历的内部实现细节。
比如下面的 _ArrayList_ 和  _ImmutableList_ 遍历的例子：
```

public class IteratorTest {

    public static List<Integer> list = Lists.newArrayList(1, 10, 11, 18, -1, 20, 99);

    public static ImmutableList<Integer> integerList = ImmutableList.copyOf(list);

    public static void main(String[] args) {

        Iterator<Integer> iterator1 = list.iterator();
        while (iterator1.hasNext()) {
            System.out.println(iterator1.next());
        }

        Iterator<Integer> iterator2 = integerList.iterator();
        while (iterator2.hasNext()) {
            System.out.println(iterator2.next());
        }

    }
```
我们去遍历的时候并不需要关心内部细节，但实际上ImmutableList是一个固定容量的list,不能进行 _remove_ 和  _add_ 方法的操作

**1.2.2 fail-fast模拟**
fast-fail事件产生的条件：当多个线程对Collection进行操作时，若其中某一个线程通过iterator去遍历集合时，该集合的内容被其他线程所改变；则会抛出 _ConcurrentModificationException_ 异常
```

public class IteratorTest {

    private static List<Integer> list = Lists.newArrayList(1, 10, 11, 18, -1, 20, 99);

    public static void main(String[] args) throws InterruptedException {

        final IteratorTest test = new IteratorTest();
        final ThreadFactory threadFactory = new ThreadFactoryBuilder().setNameFormat("iterator-[%d]").build();
        final RejectedExecutionHandler handler = new ThreadPoolExecutor.AbortPolicy();
        final ThreadPoolExecutor pool = new ThreadPoolExecutor(2, 8, 5L,
                TimeUnit.SECONDS, new SynchronousQueue<>(false), threadFactory, handler);
        final CountDownLatch latch = new CountDownLatch(1);

        for (int i = 0; i < 5; i++) {

            final int index = i;

            Runnable task = () -> {
                try {
                    latch.await();
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
                int seed = ThreadLocalRandom.current().nextInt(2);
                if (Range.closedOpen(0, 2).contains(seed)) {
                    list.add(index * seed);
                } else {
                    list.remove(index + 1);
                }
                test.iteratorElements();
            };
            pool.execute(task);

        }
        latch.countDown();
        System.out.println("start task");

        TimeUnit.SECONDS.sleep(5);
        pool.shutdown();

    }

    public void iteratorElements() {

        Iterator<Integer> iterator1 = list.iterator();
        while (iterator1.hasNext()) {
            System.out.println(Thread.currentThread().getName() + ": " + iterator1.next());
        }

    }

}
```
随机打印结果如下
```
start task
iterator-[2]: 1
iterator-[3]: 1
iterator-[3]: 10
iterator-[1]: 1
iterator-[3]: 11
iterator-[3]: 18
iterator-[3]: -1
iterator-[3]: 20
iterator-[3]: 99
iterator-[3]: 1
iterator-[3]: 0
iterator-[3]: 0
iterator-[3]: 3
Exception in thread "iterator-[0]" Exception in thread "iterator-[4]" Exception in thread "iterator-[2]" Exception in thread "iterator-[1]" java.util.ConcurrentModificationException
	at java.util.ArrayList$Itr.checkForComodification(ArrayList.java:901)
	at java.util.ArrayList$Itr.next(ArrayList.java:851)
	at com.nicky.copyonwrite.IteratorTest.iteratorElements(IteratorTest.java:67)
	at com.nicky.copyonwrite.IteratorTest.lambda$main$0(IteratorTest.java:48)
	at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1142)
	at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:617)
	at java.lang.Thread.run(Thread.java:745)
```
从打印结果我们可以得知，同时启动五个线程去迭代list，迭代途中iterator-[1]首先抛出异常java.util.ConcurrentModificationException！即产生fail-fast事件

### 1.3 ArrayList中ConcurrentModificationException原因
我们根据异常调用链查看源码，iterator1.next()在进入ArrayList-851行代码的时候出现错误：
```
private class Itr implements Iterator<E> {
        int cursor;       //下个返回元素的位置
        int lastRet = -1; // 上一个返回元素的位置; 如果是-1则一个表示没有这个元素
       
        // 以后每次遍历List中的元素的时候，都会比较expectedModCount和modCount是否相等；
        // 若不相等，则抛出ConcurrentModificationException异常，产生fail-fast事件。
        int expectedModCount = modCount;
        //如果下一个可返回元素位置不等于list的size
        public boolean hasNext() {
            return cursor != size;
        }

        @SuppressWarnings("unchecked")
        public E next() {
          //如果下一个可返回元素位置不等于list的size，抛异常
            checkForComodification();
            int i = cursor;
            //如果下一个元素的位置大于size则抛出NoSuchElementException
            if (i >= size)
                throw new NoSuchElementException();
           //获取外部类ArrayList实例中的数据
            Object[] elementData = ArrayList.this.elementData;
       //快速失败机制
            if (i >= elementData.length)
                throw new ConcurrentModificationException();
            //下一个可访问的元素位置+1
            cursor = i + 1;
            //返回值并给lastRet赋值
            return (E) elementData[lastRet = i];
        }

        public void remove() {
            if (lastRet < 0)
                throw new IllegalStateException();
            checkForComodification();

            try {
              //移除上一个返回 的元素
                ArrayList.this.remove(lastRet);
              //给下一个访问元素位置更新
                cursor = lastRet;
                //给上一个访问元素复原
                lastRet = -1;
                expectedModCount = modCount;
            } catch (IndexOutOfBoundsException ex) {
                throw new ConcurrentModificationException();
            }
        }
```
很好理解，迭代器尽最大努力检查遍历途中list的容量是否改变，或者元素的偏移量发生了变动，如改变，则抛出ConcurrentModificationException异常

# 2 fail-safe

### 2.1 定义
fail-safe任何对集合结构的修改都会在一个复制的集合上进行修改，因此不会抛出ConcurrentModificationException

**fail-safe机制有两个问题**
* 1 需要复制集合，产生大量的无效对象，开销大
* 2 无法保证读取的数据是目前原始数据结构中的数据。


### 2.2 解决fail-fast之CopyOnWriteArrayList
我们查看下add方法和remove方法的源码：
```

public boolean add(E e) {
        final ReentrantLock lock = this.lock;
        lock.lock();
        try {
            Object[] elements = getArray();
            int len = elements.length;
            Object[] newElements = Arrays.copyOf(elements, len + 1);
            newElements[len] = e;
            setArray(newElements);
            return true;
        } finally {
            lock.unlock();
        }
    }
...........................
    public E remove(int index) {
        final ReentrantLock lock = this.lock;
        lock.lock();
        try {
            Object[] elements = getArray();
            int len = elements.length;
            E oldValue = get(elements, index);
            int numMoved = len - index - 1;
            if (numMoved == 0)
                setArray(Arrays.copyOf(elements, len - 1));
            else {
                Object[] newElements = new Object[len - 1];
                System.arraycopy(elements, 0, newElements, 0, index);
                System.arraycopy(elements, index + 1, newElements, index,
                                 numMoved);
                setArray(newElements);
            }
            return oldValue;
        } finally {
            lock.unlock();
        }
    }
```
在添加元素或删除元素操作时候都会上锁，然后创建一个新的数组，让当前下标的元素删除或者添加，最后将原数组的地址指向新的数组，完成复制。
这样的好处是不会出现fail-fast,但是只要增删操作就会上锁，影响效率。同时增加对象容量，容易OOM。并且在遍历中，list的元素并不一定是最终的元素集合，所以只能保证最终一致性

### 2.3 fail-fast和 fail-safe 的区别
![两者区别](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510093144.png)

# 3 Reference
http://www.cnblogs.com/skywang12345/p/3308762.html
