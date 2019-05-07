

---
title: JNDI知识摘要
date: 2018-06-25T11:18:15+08:00
weight: 70
slug: jndi-introdution
tags: ["基础"]
categories: ["java-base"]
author: "nicky_chin"
comments: true
share: true
draft: false
---



#1  什么是JNDI？
JNDI(Java Naming and Directory Interface,Java命名和目录接口)是SUN公司提供的一种标准的Java命名系统接口，JNDI提供统一的客户端API，通过不同的访问提供者接口JNDI服务供应接口(SPI)的实现，由管理者将JNDI API映射为特定的命名服务和目录系统，使得Java应用程序可以和这些命名服务和目录服务之间进行交互

通过JNDI可以实现对象的创建与托管,和对象的使用过程完全解耦

 比如:**在application的底层创建对象,并将对象bind到特定的context中,对象的创建过程或者"查找"方式只有此底层模块支持,外部程序不可见.对于对象的使用者(调用者)只能通过JNDI的方式获取对象,对象使用者无法直接创建对象等**

#2 JNDI架构
![架构](https://upload-images.jianshu.io/upload_images/10175660-e3cc6625588ad25d.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

关于JNDI要注意的重要一点是，它提供了应用编程接口(application programming interface，API)和服务提供者接口(service provider interface，SPI)。这一点的真正含义是，要让应用与命名服务或目录服务交互，必须有这个服务的JNDI服务提供者，这正是JNDI SPI发挥作用的地方。服务提供者基本上是一组类，这些类为各种具体的命名和目录服务实现了JNDI接口—很像JDBC驱动为各种具体的数据库系统实现了JDBC接口一样。作为一个应用开发者，我们不必操心JNDI SPI的具体实现。只需要确认要使用的某一个命名或目录服务都有服务提供者。

JNDI提供了如下几个程序包：
>Javax.naming：包含了访问命名服务的类和接口。例如，它定义了Context接口，这是命名服务执行查询的入口。
Javax.naming.directory：对命名包的扩充，提供了访问目录服务的类和接口。例如，它为属性增加了新的类，提供了表示目录上下文的DirContext接口，定义了检查和更新目录对象的属性的方法。
Javax.naming.event：提供了对访问命名和目录服务时的事件通知的支持。例如，定义了NamingEvent类，这个类用来表示命名/目录服务产生的事件，定义了侦听NamingEvents的NamingListener接口。
Javax.naming.ldap：这个包提供了对LDAP 版本3扩充的操作和控制的支持，通用包javax.naming.directory没有包含这些操作和控制。
Javax.naming.spi：这个包提供了一个方法，通过javax.naming和有关包动态增加对访问命名和目录服务的支持。这个包是为有兴趣创建服务提供者的开发者提供的。

#3 案例

引入依赖
```
        <dependency>
            <groupId>com.sun.messaging.mq</groupId>
            <artifactId>fscontext</artifactId>
            <version>4.4</version>
        </dependency>

        <dependency>
            <groupId>com.sun.jndi</groupId>
            <artifactId>providerutil</artifactId>
            <version>1.2</version>
            <type>pom</type>
        </dependency>
```
文件操作实例
```
   public static void main(String[] args) throws NamingException {
        Hashtable<String,String> env = new Hashtable<>();
        //指明初始化的factory是我们下载的jar包中的RefFSContextFactory
        env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.fscontext.RefFSContextFactory");
        //指明Context的初始URL，这里我们的是d盘
        env.put(Context.PROVIDER_URL,"file:///d:/");

        Context ctx = new InitialContext(env);

        //在C盘下创建要给文件夹
        ctx.createSubcontext("testDir");

        //在C盘下定位myFile文件
        File f =  (File) ctx.lookup("test01.py");
        System.out.println(f);

        //列出当前context下的所有元素的名称和类型(包括文件夹和文件)
        NamingEnumeration list = ctx.list("/");
        while (list.hasMore()) {
            NameClassPair nc = (NameClassPair)list.next();
            System.out.println(nc);
        }
    }
```

# Reference
具体使用方式可参考：[JNDI简介与SPI实现](http://shift-alt-ctrl.iteye.com/blog/1971329)
