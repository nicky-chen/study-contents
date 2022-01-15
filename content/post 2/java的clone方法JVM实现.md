
---
title: java的clone方法JVM实现
date: 2021-02-13T21:31:09+08:00
weight: 70
slug: java-clone
tags: ["基础"]
categories: ["java-base"]
author: "nicky_chin"
comments: true
share: true
draft: false
---

例子

```java
class Base {
 String name;
 public Base(String name) {
 this.name = name;
 }
}

```

构造clone的类

```java

lass Cat implements Cloneable {
 String name;
 int age;
 Base base;
 public Cat(String name, int age, Base base) {
 this.name = name;
 this.age = age;
 this.base = base;
 }
 @Override
 protected Object clone() throws CloneNotSupportedException {
 return super.clone();
 }
 @Override
 public String toString() {
 return "{name:" + name + ", age: " + age + ", base: "+ base.name + "}";
 }
}

```

测试

```java
public static void main(String[] args) throws Exception {
 Base base = new Base("letter0");
 Cat cat1 = new Cat("miaomiao", 1, base);
 Cat cat2 = (Cat)Cat.clone();
 cat1.name = ";
 cat1.base.name = "letter1";
 System.out.println(cat2);
}

```

结果表明是浅克隆

> {name:miaomiao, age: 1, master: letter1}


JVM的实现，在jvm.cpp文件中，搜索"JVM_Clone"

![java-clone](/media/java-clone/java-clone.jpg)


根据对象或者数据的大小，从堆中开辟一块同等大小的内存，然后把原始对象的数据都复制到新的内存地址，对于基本类型，可以把原始值复制过来，但是对于内部对象来说，其保存的只是一个地址，复制时也是对地址的复制，最终还是指向同一个对象，所以就造成了上述的问题。
