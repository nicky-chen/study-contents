
---
title: 实际项目运用之Adapter模式（适配器模式）
date: 2018-05-27T11:18:15+08:00
weight: 70
slug: adapter 
tags: ["结构型"]
categories: ["design-pattern"]
author: "nicky_chin"
comments: true
share: true
draft: false
---



# 1. 模式简介

适配器模式解决的问题：让原本因为接口不兼容而不能一起工作的类可以一起工作

适配器模式中有三种角色：

*	目标接口Target：用户期望的类，可以是接口，也可以是抽象类或具体类；
*	需要适配的类Adaptee：当前系统中有的类；
*	适配器Adapter：在现有接口和目标接口之间的“适配者”

适配器模式的优点：

>通过适配器模式，用户在做相似的操作时可以调用同一个接口，其内部过程对于用户是透明的，这样做更简单、更直接、更解耦；
复用了现存的类，解决了现存类和复用环境要求不一致的问题；
将目标接口和现有接口解耦，通过引入一个适配器类，而无需修改原有的代码。

适配器模式的缺点：

>使用适配器模式后，如果想要改变适配对象，就需要更换适配器，而更换适配器是一个非常复杂的过程。

适配器模式的适用场景：
>	当系统需要使用现有的类，而现有的类不符合系统的接口
 当期望的功能和系统中现有的某个类的功能相似，但是具有不同的接口
当系统已经实现某功能，但用户想通过另种接口方式访问，而不想修改原有接口
当使用的第三方组件的接口和系统中定义好的接口不同，不希望修改系统接口


# 2.案例代码

适配器分类_适配器模式_和_对象适配器模式_

**2.1 类适配器UML**

![类适配器类图](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510111526.png)

**2.2 对象适配器模式UML**

![对象适配器类图](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510111554.png)

**2.3 案例代码：**

被适配对象
```
public class Adaptee {
	public void adapteeMethod() {
		System.out.println("这是我们已经实现的功能！");
	}
}
```
对象适配器
```
public class Adapter implements Target {

	private Adaptee adaptee = new Adaptee();

	@Override
	public void targetMethod() {
		adaptee.adapteeMethod();
	}
}
```

目标接口

```
public interface Target {
	void targetMethod();
}
```
客户端调用

```
public class Client {

    public static void main(String[] args) {
        Target target = new Adapter();
        target.targetMethod();
        
    }
}
```

--------------
# 3.JAVA源码中的运用

有时候我们需要把集合变成线程安全的集合
```
List<Integer> list = Collections.synchronizedList(new ArrayList<>(10));      
Map<String, String> map = Collections.synchronizedMap(new HashMap<>(8));
```
就拿Collections.synchronizedMap()来分析源码，其中

目标接口 
```
Map<K,V> m
```
不多做说明，大家应该都知道这是字典的接口

被适配对象
```
new HashMap<>(8)
```
同步适配器 _SynchronizedMap_
```
    private static class SynchronizedMap<K,V>
        implements Map<K,V>, Serializable {
        private static final long serialVersionUID = 1978198479659022715L;

        private final Map<K,V> m;     // Backing Map
        final Object      mutex;        // Object on which to synchronize

        SynchronizedMap(Map<K,V> m) {
            this.m = Objects.requireNonNull(m);
            mutex = this;
        }

        SynchronizedMap(Map<K,V> m, Object mutex) {
            this.m = m;
            this.mutex = mutex;
        }

        public int size() {
            synchronized (mutex) {return m.size();}
        }
        public boolean isEmpty() {
            synchronized (mutex) {return m.isEmpty();}
        }
        public boolean containsKey(Object key) {
            synchronized (mutex) {return m.containsKey(key);}
        }
        public boolean containsValue(Object value) {
            synchronized (mutex) {return m.containsValue(value);}
        }
        public V get(Object key) {
            synchronized (mutex) {return m.get(key);}
        }
 public V put(K key, V value) {
            synchronized (mutex) {return m.put(key, value);}
        }
        
//////////////此处省略方法
}

```
很容易理解，在调用 synchronizedMap方法
```
public static <K,V> Map<K,V> synchronizedMap(Map<K,V> m) {
        return new SynchronizedMap<>(m);
    }
```
创建了一个同步适配器对象，其实就是注册了一把_mutex锁_
```
SynchronizedMap(Map<K,V> m) {
            this.m = Objects.requireNonNull(m);
            mutex = this;
        }
```
然后在调用具体方法的时候会竟如同步块，比如put方法
```
 public V put(K key, V value) {
            synchronized (mutex) {return m.put(key, value);}
        }
        
```
通过这种方式实现了map的线程安全同步，_Collections.synchronizedList方法_同理


# 4. 实际项目中运用

背景：有时候对于类的toString方法需要做修改，如果属性为空则赋值一些默认值，或者字符串为空的时候返回的是空字符串等，对此可以进行一些优化

抽象父类 _AbstractDO_
```
@Getter
@Setter
@EqualsAndHashCode(callSuper = false, of = {"id"})
public abstract class AbstractDO implements Serializable {

    private static final long serialVersionUID = -1679770357930200297L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Date createTime;

    private Date updateTime;

}
```

具体实体类 _SysResources_

```
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SysResources extends AbstractDO {

    private static final long serialVersionUID = 1936021577348624761L;

    /**
     * 资源名
     */
    private String name;

    /**
     * 资源类型
     */
    private String type;

    /**
     * 资源地址
     */
    private String url;

    /**
     * 资源权限
     */
    private String permission;

    /**
     * 父级资源
     */
    private Long parentId;

    /**
     * 排序
     */
    private Integer sort;

    /**
     * 是否外部链接
     */
    private Boolean external;

    private Boolean available;

    /**
     * 资源图标
     */
    private String icon;

    @Transient
    private String checked;

    @Transient
    private SysResources parent;

    @Transient
    @Singular
    private List<SysResources> nodes;

    @Override
    public String toString() {
        //正常字符串拼接 省略
    }
}
```

首先我的想法是不希望每次新建一个属性的时候去重新生成toString方法，当然你可以使用lombok的ToString注解去解决问题，下面说下我的思路：

目标对象 _AdapteeTarget_

```
public interface AdapteeTarget {

    @Override
    String toString();

    /**
     * StringBuilder拼接字符串
     * @param capacity 初始化容量
     */
    default String builderToString(int capacity) {
        final StringBuilder builder = new StringBuilder(capacity);
        try {
            BeanInfo beanInfo = Introspector.getBeanInfo(this.getClass(), Object.class);
            PropertyDescriptor[] list = beanInfo.getPropertyDescriptors();
            builder.append(beanInfo.getBeanDescriptor().getName()).append("{");
            for (int i = 0; i < list.length; i++) {
                PropertyDescriptor descriptor = list[i];
                if (i > 0) {
                    builder.append(", ");
                }
                builder.append(descriptor.getName()).append("=").append(descriptor.getReadMethod().invoke(this));
            }
            builder.append("}");
        } catch (IntrospectionException | ReflectiveOperationException e) {
            e.printStackTrace();
        }
        return builder.toString();
    }

}
```
上面接口使用了java8接口的新特性和[java内省知识对于javabean对象的获取](https://nicky-chen.github.io/2018/03/13/introspector/)

首先基于类适配器思想，让 SysResources去实现AdapteeTarget这个接口，并重写toString方法。代码如下：
```
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SysResources extends AbstractDO implements AdapteeTarget{

    private static final long serialVersionUID = 1936021577348624761L;

    //关键代码。。。。。。。。。。。。
    @Override
    public String toString() {
        return this.builderToString(1 << 10);
    }
}
```
这样如果项目中有很多实体类的时候，只需实现AdapteeTarget接口，覆写toString方法使用默认的this.builderToString方法就可以很方便解决问题。当然你可以说虽然你为了使用stringbuilder去优化字符串拼接，但是同时使用了反射，性能上并不能多大提升。确实，这样的写法只是减少对象的创建，但是性能不是最好的。

但是，如果需要对toString方法有些定制化需求,也是一种选择。比如我们需要String类型的字段默认值为空字符串，那么我们可以创建如下适配器：

字符串空适配器 _StringAdapter_
```
public class StringAdapter<T> implements AdapteeTarget {

    private T t;

    private int capacity;

    public StringAdapter(T t, int capacity) {
        this.t = t;
        this.capacity = capacity;
    }

    @Override
    public String toString() {
       return ToStringUtil.getObjectString(t, capacity);
    }
}
```

_ToStringUtil_ 工具类
```
public final class ToStringUtil {

    /**
     * 字符串属性默认为""
     */
    public static String getObjectString(Object t, int capacity) {
        final StringBuilder builder = new StringBuilder(capacity);
        try {
            BeanInfo beanInfo = Introspector.getBeanInfo(t.getClass(), Object.class);
            PropertyDescriptor[] list = beanInfo.getPropertyDescriptors();
            builder.append(beanInfo.getBeanDescriptor().getName()).append("{");
            commonBuilder(t, builder, list);
            builder.append("}");
        } catch (IntrospectionException | ReflectiveOperationException e) {
            e.printStackTrace();
        }
        return builder.toString();
    }

    public static String getObjectStringValue(Class t, int capacity) {
        final StringBuilder builder = new StringBuilder(capacity);
        try {
            BeanInfo beanInfo = Introspector.getBeanInfo(t, Object.class);
            Object obj = t.newInstance();
            PropertyDescriptor[] list = beanInfo.getPropertyDescriptors();
            builder.append(beanInfo.getBeanDescriptor().getName()).append("{");
            commonBuilder(obj, builder, list);
            builder.append("}");
        } catch (IntrospectionException | ReflectiveOperationException e) {
            e.printStackTrace();
        }
        return builder.toString();
    }

    /**
     * 设置属性默认之短
     */
    public static String getObjectStringNotEmpty(Object t, int capacity, Map<Class, Object> map) {

        if (CollectionUtils.isEmpty(map)) {
            return getObjectString(t, capacity);
        }
        final StringBuilder builder = new StringBuilder(capacity);
        try {
            BeanInfo beanInfo = Introspector.getBeanInfo(t.getClass(), Object.class);
            PropertyDescriptor[] list = beanInfo.getPropertyDescriptors();
            builder.append(beanInfo.getBeanDescriptor().getName()).append("{");
            defaultBuilder(t, map, builder, list);
            builder.append("}");
        } catch (IntrospectionException | ReflectiveOperationException e) {
            e.printStackTrace();
        }
        return builder.toString();
    }

    public static String getObjectDefaultValue(Class cls, int capacity, Map<Class, Object> map) {

        final StringBuilder builder = new StringBuilder(capacity);
        try {
            Object obj = cls.newInstance();
            BeanInfo beanInfo = Introspector.getBeanInfo(cls, Object.class);
            PropertyDescriptor[] list = beanInfo.getPropertyDescriptors();
            builder.append(beanInfo.getBeanDescriptor().getName()).append("{");
            defaultBuilder(obj, map, builder, list);
            builder.append("}");
        } catch (IntrospectionException | ReflectiveOperationException e) {
            e.printStackTrace();
        }
        return builder.toString();
    }

    private static void defaultBuilder(Object t, Map<Class, Object> map, StringBuilder builder,
            PropertyDescriptor[] list) throws IllegalAccessException, InvocationTargetException {
        for (int i = 0; i < list.length; i++) {
            PropertyDescriptor descriptor = list[i];
            if (i > 0) {
                builder.append(", ");
            }
            builder.append(descriptor.getName()).append("=");
            Object o = descriptor.getReadMethod().invoke(t);
            Class type = descriptor.getPropertyType();
            if (Objects.isNull(o) && map.containsKey(type)) {
                builder.append(map.get(type));
            } else {
                builder.append(o);
            }

        }
    }

    private static void commonBuilder(Object t, StringBuilder builder, PropertyDescriptor[] list)
            throws IllegalAccessException, InvocationTargetException {
        for (int i = 0; i < list.length; i++) {
            PropertyDescriptor descriptor = list[i];
            if (i > 0) {
                builder.append(", ");
            }
            builder.append(descriptor.getName()).append("=");
            Object o = descriptor.getReadMethod().invoke(t);
            if (descriptor.getPropertyType() == String.class && Objects.isNull(o)) {
                builder.append("''");
            } else {
                builder.append(o);
            }

        }
    }

}
```
我们按对象适配器的方式改造SysResources
```
public class SysResources extends AbstractDO {

    @Override
    public String toString() {
        AdapteeTarget target = new StringAdapter<>(this, 1 << 7);
        return target.toString();
    }

    public static void main(String[] args) {
        System.out.println(new SysResources());
    }
}
```
创建一个空对象，打印接口如下：
```
SysResources{available=null, checked='', createTime=null, external=null, icon='', id=null, name='', nodes=null, parent=null, parentId=null, permission='', sort=null, type='', updateTime=null, url=''}

```

String字段的默认值都变成了空字符串

-------------
当然我们也有其他需求，比如修改其他类型的默认值，那我们可以创建如下适配器：

默认值自定义适配器 _DefaultValueAdapter_
```
@AllArgsConstructor
public class DefaultValueAdapter<T> implements AdapteeTarget {

    private T t;

    private int capacity;

    private Map<Class, Object> map;

    @Override
    public String toString() {
        return ToStringUtil.getObjectStringNotEmpty(t, capacity, map);
    }
}
```
然后在重写 SysResources的toString方法

```
@Override
    public String toString() {
        Map<Class, Object> map = new HashMap<>(5);
        map.put(Boolean.class, false);
        map.put(Long.class, -1L);
        map.put(List.class, new ArrayList<>(1));
        AdapteeTarget target = new DefaultValueAdapter<>(this, 1 << 10, map);
        return target.toString();
    }
```
new一个对象得到的结果如下：
```
SysResources{available=false, checked=null, createTime=null, external=false, icon=null, id=-1, name=null, nodes=[], parent=null, parentId=-1, permission=null, sort=null, type=null, updateTime=null, url=null}
```
Long类型的默认值为-1，Boolean对象默认值是 false

另外当我们还有其他需求，比如toString方法只打印部分字段那么又必须写新的类,当适配器数量到达一定程定，我们可以参考Collections工具类考虑使用简单工厂方法：

适配器 _AdapterFactory_
```
public final class AdapterFactory {

    //默认值设定
    public static  String builderDefaultValueAdapter(Map<Class,Object> map, int capacity, Class cls) {
        return new DefaultValueAdapter(cls, capacity, map).toString() ;
    }
   //空字符串设定
    public static String builderStringValueAdapter(Class cls, int capacity) {
        return new StringAdapter(cls, capacity).toString();
    }

    @AllArgsConstructor
    private static class DefaultValueAdapter implements AdapteeTarget {

        private Class t;

        private int capacity;

        private Map<Class, Object> map;


        @Override
        public String toString() {
            return ToStringUtil.getObjectDefaultValue(t, capacity, map);
        }
    }

    private static class StringAdapter implements AdapteeTarget {

        private Class t;

        private int capacity;

        public StringAdapter(Class t, int capacity) {
            this.t = t;
            this.capacity = capacity;
        }

        @Override
        public String toString() {
            return ToStringUtil.getObjectStringValue(t, capacity);
        }
    }

}
```
那么需要改进toString方法，如下:

```
    @Override
    public String toString() {
//        Map<Class, Object> map = new HashMap<>(5);
//        map.put(Boolean.class, false);
//        map.put(Long.class, -1L);
//        map.put(List.class, new ArrayList<>(1));
//        return AdapterFactory.builderDefaultValueAdapter(map, 1 << 10, SysResources.class);
        return AdapterFactory.builderStringValueAdapter(SysResources.class, 1 << 10);
    }
```
这样就可以通过简单工厂调用具体的适配器，这样写的好处就是可以减少创建多个类文件，防止类爆炸。当然如果对于重写equalsandhashcode方法也需要不同的算法的场景，则可以使用策略模式，然后再使用工厂方法去实现单工厂多个模式生产线









