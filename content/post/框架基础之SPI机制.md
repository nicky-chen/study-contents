Title: 框架基础之SPI机制
Date: 2018-07-05 19:22
Tags: 框架基础
Category: java-base
Slug: spi-introduction


#1 定义

**SPI** 的全名为 _Service Provider Interface_ ，用于接口寻找服务实现类

**实现方式**
>标准制定者制定接口
不同厂商编写针对于该接口的实现类，并在jar的“classpath:META-INF/services/全接口名称”文件中指定相应的实现类全类名
开发者直接引入相应的jar，就可以实现为接口自动寻找实现类的功能

#2 案例实现

比如我们经常看到的缓存类Cache,现在有非常多的缓存框架都会去实现这个接口

*标准接口*
```
:::java
public interface Cache {

    String getName();

    <T> T get(Object key, Class<T> type);

    void put(Object key, Object value);

    void evict(Object key);

    void clear();

}
```

*厂商的具体接口实现*

```
:::java
public class ConcurrentMapCache implements Cache {

    private final String name;

    private final ConcurrentMap<Object, Object> store;

    public ConcurrentMapCache() {
        this("defaultMapCache");
    }

    public ConcurrentMapCache(String name) {
        this(name, new ConcurrentHashMap<>(256), true);
    }

    public ConcurrentMapCache(String name, ConcurrentMap<Object, Object> store, boolean allowNullValues) {
        this.name = name;
        this.store = store;
    }


    @Override
    public final String getName() {
        return this.name;
    }

    @Override
    public <T> T get(Object key, Class<T> type) {
        Object value = this.store.get(key);
        if (value != null && type != null && !type.isInstance(value)) {
            throw new IllegalStateException("Cached value is not of required type [" + type.getName() + "]: " + value);
        }
        return (T) value;
    }

    @Override
    public void put(Object key, Object value) {
        this.store.putIfAbsent(key, value);
    }

    @Override
    public void evict(Object key) {
        this.store.remove(key);
    }

    @Override
    public void clear() {
        this.store.clear();
    }

}
```
注意:**一定要有默认无参构造器，否则之后无法通过SPI机制实例化对象**

**配置地址**

![配置文件](https://upload-images.jianshu.io/upload_images/10175660-80ce95ea81d45952.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

>在resouce下的META-INF\services文件下的spi.Cache文件内容是服务类的全限命名：spi.ConcurrentMapCache

打包jar并引入到项目

**测试**
```
:::java
public class CacheSpiTest {

    public static void main(String[] args) {

        ServiceLoader<Cache> serviceLoader = ServiceLoader.load(Cache.class);
        Iterator<Cache> iterator = serviceLoader.iterator();
        while (iterator.hasNext()) {
            Cache cache = iterator.next();
            System.out.println(cache.getName());
            cache.put("user", "nana");
            System.out.println(cache.get("user", String.class));
        }
    }
}
```

打印结果：
```
defaultMapCache
nana
```
说明获取到了定制接口的实现类对象

通过上述例子，我们知道`ServiceLoader`是用于通过接口获取接口实现类的工具


#3 SPI机制源码分析

###3.1 load加载过程

ServiceLoader成员变量
```
:::java
//SPI约定获取扩展接口路径的文件
private static final String PREFIX = "META-INF/services/";
//基础约定接口
private final Class<S> service;

private final ClassLoader loader;
//权限控制上下文
private final AccessControlContext acc;
//厂商接口实现类的实例化对象集合
private LinkedHashMap<String,S> providers = new LinkedHashMap<>();//以初始化的顺序缓存<接口全名称, 实现类实例>
//懒加载迭代器
private LazyIterator lookupIterator
```
`load()`初始化
```
:::java
   public void reload() {
        providers.clear();
        lookupIterator = new LazyIterator(service, loader);
    }

    private ServiceLoader(Class<S> svc, ClassLoader cl) {
        service = Objects.requireNonNull(svc, "Service interface cannot be null");
        loader = (cl == null) ? ClassLoader.getSystemClassLoader() : cl;
        acc = (System.getSecurityManager() != null) ? AccessController.getContext() : null;
        reload();
    }
```
`load()` 方法并没有实例化具体实现类，而是加载需要实例化的对象路径

###3.2 实例化过程

```
:::java
 Class<S> service;//通用接口
 ClassLoader loader;//类加载器
Enumeration<URL> configs = null;//厂商接口文件URL的集合
 Iterator<String> pending = null;//接口具体实现的路径类名列表

  public boolean hasNext() {
            if (acc == null) {//访问控制上下文是否为空
                return hasNextService();
            } else {
                PrivilegedAction<Boolean> action = new PrivilegedAction<Boolean>() {
                    public Boolean run() { return hasNextService(); }
                };
                return AccessController.doPrivileged(action, acc);
            }
        }

        public S next() {
            if (acc == null) {
                return nextService();
            } else {
                PrivilegedAction<S> action = new PrivilegedAction<S>() {
                    public S run() { return nextService(); }
                };
                return AccessController.doPrivileged(action, acc);
            }
        }
```
`hasNext()` : 先从provider中查找，如果有，返回true；如果没有，通过*LazyIterator* 来进行查找. 在 `hasNext()` 方法中会获取当前需要实例化的类名 **nextName** ，然后在 `next()` 方法中具体实例化

`next()`: 先从provider中直接获取，如果有，返回实现类对象实例；如果没有，通过*LazyIterator* 中 `nextService()` 来进行获取

```
:::java
 private S nextService() {
            if (!hasNextService()) //获取nextName 需要加载的类名
                throw new NoSuchElementException();
            String cn = nextName;
            nextName = null;
            Class<?> c = null;
            try {
                c = Class.forName(cn, false, loader);
            } catch (ClassNotFoundException x) {
                fail(service,
                     "Provider " + cn + " not found");
            }
            if (!service.isAssignableFrom(c)) {
                fail(service,
                     "Provider " + cn  + " not a subtype");
            }
            try {
                S p = service.cast(c.newInstance()); //初始化类并类型转换成Cache对象
                providers.put(cn, p); 放入实例化对象集合中
                return p;
            } catch (Throwable x) {
                fail(service,
                     "Provider " + cn + " could not be instantiated", x);
            }
            throw new Error();          // This cannot happen
        }

```
上述代码主要是延迟实例化类，然后缓存进集合，方便下次直接使用



