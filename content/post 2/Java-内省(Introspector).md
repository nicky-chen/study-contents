

---
title: Java 内省(Introspector)
date: 2018-03-13T11:18:15+08:00
weight: 70
slug: introspector
tags: ["基础"]
categories: ["java-base"]
author: "nicky_chin"
comments: true
share: true
draft: false
---




**内省(Introspector) 是Java 语言对 JavaBean 类属性、事件的一种缺省处理方法。**

　　JavaBean是一种特殊的类，主要用于传递数据信息，这种类中的方法主要用于访问私有的字段，且方法名符合某种命名规则。如果在两个模块之间传递信息，可以将信息封装进JavaBean中，这种对象称为“值对象”(Value Object)，或“VO”。方法比较少。这些信息储存在类的私有变量中，通过set()、get()获得。

　　例如类Use :
```
public class User {

    private String name;

    private String address;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }
}
```
　在类User中有属性 name, 那我们可以通过 getName,setName来得到其值或者设置新的值。通过 getName/setName来访问 name属性，这就是默认的规则。 Java JDK中提供了一套 API 用来访问某个属性的 getter/setter 方法，这就是内省。

　　JDK内省类库：

　　PropertyDescriptor类:

　　PropertyDescriptor类表示JavaBean类通过存储器导出一个属性。主要方法：
    　　1. getPropertyType()，获得属性的Class对象;
    　　2. getReadMethod()，获得用于读取属性值的方法；getWriteMethod()，获得用于写入属性值的方法;
    　　3. hashCode()，获取对象的哈希值;
    　　4. setReadMethod(Method readMethod)，设置用于读取属性值的方法;
    　　5. setWriteMethod(Method writeMethod)，设置用于写入属性值的方法。
               　　6 getName, 获取属性名


Introspector类:

　　将JavaBean中的属性封装起来进行操作。在程序把一个类当做JavaBean来看，就是调用Introspector.getBeanInfo()方法，得到的BeanInfo对象封装了把这个类当做JavaBean看的结果信息，即属性的信息。

　　getPropertyDescriptors()，获得属性的描述，可以采用遍历BeanInfo的方法，来查找、设置类的属性。具体代码如下：

```
public class BeanDemo {

    public static void main(String[] args) throws Exception{
        final User user = new User();
        user.setName("nana");
        user.setAddress("hangzhou");

        //如果不想把父类的属性也列出来的话，那getBeanInfo的第二个参数填写父类的信息
        BeanInfo beanInfo = Introspector.getBeanInfo(user.getClass(), Object.class);
        PropertyDescriptor[] descriptor = beanInfo.getPropertyDescriptors();
        Arrays.stream(descriptor).forEach(x -> {
            System.out.println("field: " + x.getName());
            try {
                System.out.println(x.getReadMethod().invoke(user));
                x.getWriteMethod().invoke(user, "suzhou");
            } catch (ReflectiveOperationException e) {
                e.getLocalizedMessage();
            }
        });

        System.out.println(user.getAddress());

    }

}
```
结果如下：
field: address
hangzhou
field: name
nana
suzhou

这套定义的规范可以帮助我们用于处理bean信息，特别是当beanutil工具类不能满足我们需求的时候，我们可以自己去设计，比单纯通过reflect方便些

