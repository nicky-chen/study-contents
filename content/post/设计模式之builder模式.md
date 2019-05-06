
---
title: 设计模式之builder模式
date: 2017-12-19T11:18:15+08:00
weight: 70
slug: builder
tags: ["创建型"]
categories: ["design-pattern"]
author: "nicky_chin"
comments: true
share: true
draft: false
---


建造者模式也叫生成器模式，和抽象工厂模式相似，也是一种构建复杂对象的模式。

**建造者模式中的角色分类**： 
 抽象建造者Builder：接口类型，用于规范各个产品的组成部分； 
 具体建造者ConcreteBuilder：实现Builder中的所有方法，返回一个产品实例； 
 指导者Director：指挥建造者制造相应的产品 
 产品Product：用户最终看到的复杂对象。

假设我们有一个向客户发送新年祝福邮件的需求，而邮件内容可以是纯文档的，也可以是有动画的，也可以是有音频的，可以动态的添加个组件

uml下图所示： 
![建造者模式](http://upload-images.jianshu.io/upload_images/10175660-73b74bcbd9ee9ba9.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

如上图所示，邮箱有多个组件，包含收件人，发送人，内容，音乐等 
通过具体的建造者添加不同的组件模版，最后通过指挥者去调用抽象建造者 
来返回具体的email对象

代码如下
==================product======================
```
public interface Module {

String showInfo(String info);

}`

public abstract class CommonModule implements Module {

protected String moduleName;

protected String productionTime() {
    return Optional.ofNullable(moduleName).orElse("") + "--> createTime : " + LocalDate.now().toString();
}

}

public class Sender extends CommonModule{

public Sender() {
    super.moduleName = "发件人";
}

@Override
public String showInfo(String info) {
    return Optional.ofNullable(info).orElse("sender : nicky@qq.com \n");
}

}

public class Receiver extends CommonModule {

public Receiver() {
    super.moduleName = "收件人";
}

@Override
public String showInfo(String info) {
    return Optional.ofNullable(info).orElse("receiver : nana@qq.com \n");
}

} 
public class Title extends CommonModule{

public Title() {
    super.moduleName = "标题";
}

@Override
public String showInfo(String info) {
    return Optional.ofNullable(info).orElse("title:【拜年】 \n");
}

}

public class Content extends CommonModule{

public Content() {
    super.moduleName = "正文";
}

@Override
public String showInfo(String info) {
     return Optional.ofNullable(info).orElse("content : 新年快乐，666 \n") ;
}

}

public class Music extends CommonModule{

public Music() {
    super.moduleName = "音乐";
}

@Override
public String showInfo(String info) {
    return Optional.ofNullable(info).orElse("music : 新年好呀，新年好呀，祝贺大家新年好\n");
}

}

public class Cartoon extends CommonModule{

public Cartoon() {
    super.moduleName = "动画效果";
}

@Override
public String showInfo(String info) {
    return Optional.ofNullable(info).orElse("动画，我是动画\n");
}

}

public class Email {

private List<Module> parts;

public Email() {
    this.parts = new ArrayList<>(1 << 3);
}

public final void addComponent(Module module) {
    parts.add(module);
}

public void generateEmail() {
    parts.forEach(x -> System.out.println(x.showInfo(null)));
    System.out.println("==============================");
}

}
```

==================builder========================= 

```
public abstract class Builder {

protected Email email;

public Builder() {
    email = new Email();
}

public abstract Email builderObject();

}

public class EmailBuilder1 extends Builder {

@Override
public Email builderObject() {
    email.addComponent(new Sender());
    email.addComponent(new Receiver());
    email.addComponent(new Title());
    email.addComponent(new Content());
    return super.email;
}

}

public class EmailBuilder2 extends Builder {

@Override
public Email builderObject() {
    email.addComponent(new Sender());
    email.addComponent(new Receiver());
    email.addComponent(new Title());
    email.addComponent(new Content());
    email.addComponent(new Music());
    return super.email;
}

}

public class EmailBuilder3 extends Builder {

@Override
public Email builderObject() {
    email.addComponent(new Sender());
    email.addComponent(new Receiver());
    email.addComponent(new Title());
    email.addComponent(new Content());
    email.addComponent(new Cartoon());
    return super.email;
}

}
```

===============指挥者==================

```
public class Director {

private String name;
private Builder builder;

public Director(String name, Builder builder) {
    this.name = name;
    this.builder = builder;
}

public void buildConcreteEmail() {
    System.out.println("build product for " + name);
    Email email = builder.builderObject();
    email.generateEmail();
}

}
```

================调用者====================== 

```
public class Client {

public static void main(String[] args) {

    Director director1 = new Director("common Email", new EmailBuilder1());
    director1.buildConcreteEmail();

    Director director2 = new Director("music Email", new EmailBuilder2());
    director2.buildConcreteEmail();

    Director director3 = new Director("cartnoon Email", new EmailBuilder3());
    director3.buildConcreteEmail();
}

}
```
打印结果为三个不同的模版

分析

符合以下要求的对象可以使用建造者模式来创建： 
1) 需要创建的对象是一个组合结构； 
2) 需要创建的对象的创建过程不必被用户知道； 
3) 允许对象通过多个步骤来创建，并且可以改变过程。

总结 
对象的创建自由可控制（优势） 
每创建一个组合产品都需要一个单独的具体建造者建造（缺点）

建造者模式与抽象工厂模式的区别： 
建造者模式：建造组件自由组合的产品 
抽象工厂模式：工厂多产品线生产 
两者生产的划分不同，建造者更加精细复杂

应用场景 
比较常见的是stringbuilder 
但是这个类的指挥者是调用者本身，我们去负责建造不同的具体产品对象也就是拼接的字符串对象。
