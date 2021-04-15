
---
title: 线程传递增强之TransmittableThreadLocal
date: 2020-09-26T18:59:09+08:00
weight: 70
slug: threadlocal-enchancer
tags: ["多线程"]
categories: ["concurrent"]
author: "nicky_chin"
comments: true
share: true
draft: false
---


先来看TTL里面的几个重要属性及方法

TTL定义：

```
public class TransmittableThreadLocal extends InheritableThreadLocal
```
可以看到，TTL继承了ITL，意味着TTL首先具备ITL的功能。

再来看看一个重要属性holder：

```

   /**
     * 这是一个ITL类型的对象，持有一个全局的WeakMap（weakMap的key是弱引用，同TL一样，也是为了解决内存泄漏的问题），里面存放了TTL对象
     * 并且重写了initialValue和childValue方法，尤其是childValue，可以看到在即将异步时父线程的属性是直接作为初始化值赋值给子线程的本地变量对象（TTL）的
     */
    private static InheritableThreadLocal<Map<TransmittableThreadLocal<?>, ?>> holder =
            new InheritableThreadLocal<Map<TransmittableThreadLocal<?>, ?>>() {
                @Override
                protected Map<TransmittableThreadLocal<?>, ?> initialValue() {
                    return new WeakHashMap<TransmittableThreadLocal<?>, Object>();
                }

                @Override
                protected Map<TransmittableThreadLocal<?>, ?> childValue(Map<TransmittableThreadLocal<?>, ?> parentValue) {
                    return new WeakHashMap<TransmittableThreadLocal<?>, Object>(parentValue);
                }
            };

```

再来看下set和get：

//下面的方法均属于TTL类
```
@Override
    public final void set(T value) {
        super.set(value);
        if (null == value) removeValue();
        else addValue();
    }

    @Override
    public final T get() {
        T value = super.get();
        if (null != value) addValue();
        return value;
    }
    
    private void removeValue() {
        holder.get().remove(this); //从holder持有的map对象中移除
    }

    private void addValue() {
        if (!holder.get().containsKey(this)) {
            holder.get().put(this, null); //从holder持有的map对象中添加
        }
    }
```
TTL里先了解上述的几个方法及对象，可以看出，单纯的使用TTL是达不到支持线程池本地变量的传递的，通过第一部分的例子，可以发现，除了要启用TTL，还需要通过TtlExecutors.getTtlExecutorService包装一下线程池才可以，那么，下面就来看看在程序即将通过线程池异步的时候，TTL帮我们做了哪些操作（这一部分是TTL支持线程池传递的核心部分）：

首先打开包装类，看下execute方法在执行时做了些什么。

// 此方法属于线程池包装类ExecutorTtlWrapper
```
@Override
    public void execute(@Nonnull Runnable command) {
        executor.execute(TtlRunnable.get(command)); //这里会把Rannable包装一层，这是关键，有些逻辑处理，需要在run之前执行
    }

    // 对应上面的get方法，返回一个TtlRunnable对象，属于TtLRannable包装类
    @Nullable
    public static TtlRunnable get(@Nullable Runnable runnable) {
        return get(runnable, false, false);
    }

    // 对应上面的get方法
    @Nullable
    public static TtlRunnable get(@Nullable Runnable runnable, boolean releaseTtlValueReferenceAfterRun, boolean idempotent) {
        if (null == runnable) return null;

        if (runnable instanceof TtlEnhanced) { // 若发现已经是目标类型了（说明已经被包装过了）直接返回
            // avoid redundant decoration, and ensure idempotency
            if (idempotent) return (TtlRunnable) runnable;
            else throw new IllegalStateException("Already TtlRunnable!");
        }
        return new TtlRunnable(runnable, releaseTtlValueReferenceAfterRun); //最终初始化
    }

    // 对应上面的TtlRunnable方法
    private TtlRunnable(@Nonnull Runnable runnable, boolean releaseTtlValueReferenceAfterRun) {
        this.capturedRef = new AtomicReference<Object>(capture()); //这里将捕获后的父线程本地变量存储在当前对象的capturedRef里
        this.runnable = runnable;
        this.releaseTtlValueReferenceAfterRun = releaseTtlValueReferenceAfterRun;
    }

    // 对应上面的capture方法，用于捕获当前线程（父线程）里的本地变量，此方法属于TTL的静态内部类Transmitter
    @Nonnull
    public static Object capture() {
        Map<TransmittableThreadLocal<?>, Object> captured = new HashMap<TransmittableThreadLocal<?>, Object>();
        for (TransmittableThreadLocal<?> threadLocal : holder.get().keySet()) { // holder里目前存放的k-v里的key，就是需要传给子线程的TTL对象
            captured.put(threadLocal, threadLocal.copyValue());
        }
        return captured; // 这里返回的这个对象，就是当前将要使用线程池异步出来的子线程，所继承的本地变量合集
    }

    // 对应上面的copyValue，简单的将TTL对象里的值返回（结合之前的源码可以知道get方法其实就是获取当前线程（父线程）里的值，调用super.get方法）
    private T copyValue() {
        return copy(get());
    }
    protected T copy(T parentValue) {
        return parentValue;
    }
```
结合上述代码，大致知道了在线程池异步之前需要做的事情，其实就是把当前父线程里的本地变量取出来，然后赋值给Rannable包装类里的capturedRef属性，到此为止，下面会发生什么，我们大致上可以猜出来了，接下来大概率会在run方法里，将这些捕获到的值赋给子线程的holder赋对应的TTL值，那么我们继续往下看Rannable包装类里的run方法是怎么实现的：

//run方法属于Rannable的包装类TtlRunnable
```
@Override
    public void run() {
        Object captured = capturedRef.get(); // 获取由之前捕获到的父线程变量集
        if (captured == null || releaseTtlValueReferenceAfterRun && !capturedRef.compareAndSet(captured, null)) {
            throw new IllegalStateException("TTL value reference is released after run!");
        }

        /**
         * 重点方法replay，此方法用来给当前子线程赋本地变量，返回的backup是此子线程原来就有的本地变量值（原生本地变量，下面会详细讲），
         * backup用于恢复数据（如果任务执行完毕，意味着该子线程会归还线程池，那么需要将其原生本地变量属性恢复）
         */
        Object backup = replay(captured);
        try {
            runnable.run(); // 执行异步逻辑
        } finally {
            restore(backup); // 结合上面对于replay的解释，不难理解，这个方法就是用来恢复原有值的
        }
    }
```
根据上述代码，我们看到了TTL在异步任务执行前，会先进行赋值操作（就是拿着异步发生时捕获到的父线程的本地变量，赋给自己），当任务执行完，就恢复原生的自己本身的线程变量值。

下面来具体看这俩方法：

//下面的方法均属于TTL的静态内部类Transmittable
```
@Nonnull
    public static Object replay(@Nonnull Object captured) {
        @SuppressWarnings("unchecked")
        Map<TransmittableThreadLocal<?>, Object> capturedMap = (Map<TransmittableThreadLocal<?>, Object>) captured; //使用此线程异步时捕获到的父线程里的本地变量值
        Map<TransmittableThreadLocal<?>, Object> backup = new HashMap<TransmittableThreadLocal<?>, Object>(); //当前线程原生的本地变量，用于使用完线程后恢复用

        //注意：这里循环的是当前子线程原生的本地变量集合，与本方法相反，restore方法里循环这个holder是指：该线程运行期间产生的变量+父线程继承来的变量
        for (Iterator<? extends Map.Entry<TransmittableThreadLocal<?>, ?>> iterator = holder.get().entrySet().iterator();
             iterator.hasNext(); ) {
            Map.Entry<TransmittableThreadLocal<?>, ?> next = iterator.next();
            TransmittableThreadLocal<?> threadLocal = next.getKey();

            backup.put(threadLocal, threadLocal.get()); // 所有原生的本地变量都暂时存储在backup里，用于之后恢复用

            /**
             * 检查，如果捕获到的线程变量里，不包含当前原生变量值，则从当前原生变量里清除掉，对应的线程本地变量也清掉
             * 这就是为什么会将原生变量保存在backup里的原因，为了恢复原生值使用
             * 那么，为什么这里要清除掉呢？因为从使用这个子线程做异步那里，捕获到的本地变量并不包含原生的变量，当前线程
             * 在做任务时的首要目标，是将父线程里的变量完全传递给任务，如果不清除这个子线程原生的本地变量，
             * 意味着很可能会影响到任务里取值的准确性。
             *
             * 打个比方，有ttl对象tl，这个tl在线程池的某个子线程里存在对应的值2，当某个主线程使用该子线程做异步任务时
             * tl这个对象在当前主线程里没有值，那么如果不进行下面这一步的操作，那么在使用该子线程做的任务里就可以通过
             * 该tl对象取到值2，不符合预期
             */
            if (!capturedMap.containsKey(threadLocal)) {
                iterator.remove();
                threadLocal.superRemove();
            }
        }

        // 这一步就是直接把父线程本地变量赋值给当前线程了（这一步起就刷新了holder里的值了，具体往下看该方法，在异步线程运行期间，还可能产生别的本地变量，比如在真正的run方法内的业务代码，再用一个tl对象设置一个值）
        setTtlValuesTo(capturedMap);

        // 这个方法属于扩展方法，ttl本身支持重写异步任务执行前后的操作，这里不再具体赘述
        doExecuteCallback(true);

        return backup;
    }

    // 结合之前Rannable包装类的run方法来看，这个方法就是使用上面replay记录下的原生线程变量做恢复用的
    public static void restore(@Nonnull Object backup) {
        @SuppressWarnings("unchecked")
        Map<TransmittableThreadLocal<?>, Object> backupMap = (Map<TransmittableThreadLocal<?>, Object>) backup;
        // call afterExecute callback
        doExecuteCallback(false);

        // 注意，这里的holder取出来的，实际上是replay方法设置进去的关于父线程里的所有变量（结合上面来看，就是：该线程运行期间产生的变量+父线程继承来的变量）
        for (Iterator<? extends Map.Entry<TransmittableThreadLocal<?>, ?>> iterator = holder.get().entrySet().iterator();
             iterator.hasNext(); ) {
            Map.Entry<TransmittableThreadLocal<?>, ?> next = iterator.next();
            TransmittableThreadLocal<?> threadLocal = next.getKey();

            /**
             * 同样的，如果子线程原生变量不包含某个父线程传来的对象，那么就删除，可以思考下，这里的清除跟上面replay里的有什么不同？
             * 这里会把不属于原生变量的对象给删除掉（这里被删除掉的可能是父线程继承下来的，也可能是异步任务在执行时产生的新值）
             */
            if (!backupMap.containsKey(threadLocal)) {
                iterator.remove();
                threadLocal.superRemove();
            }
        }

        // 同样调用这个方法，进行值的恢复
        setTtlValuesTo(backupMap);
    }

    // 真正给当前子线程赋值的方法，对应上面的setTtlValuesTo方法
    private static void setTtlValuesTo(@Nonnull Map<TransmittableThreadLocal<?>, Object> ttlValues) {
        for (Map.Entry<TransmittableThreadLocal<?>, Object> entry : ttlValues.entrySet()) {
            @SuppressWarnings("unchecked")
            TransmittableThreadLocal<Object> threadLocal = (TransmittableThreadLocal<Object>) entry.getKey();
            threadLocal.set(entry.getValue()); //赋值，注意，从这里开始，子线程的holder里的值会被重新赋值刷新，可以参照上面ttl的set方法的实现
        }
    }
```
ok，到这里基本上把TTL比较核心的代码看完了，下面整理下整个流程，这是官方给出的时序图：

![process](/media/threadlocal-enchancer/process.png)

