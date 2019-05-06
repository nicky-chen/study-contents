---
title: 设计模式之factory模式
date: 2017-12-07T11:18:15+08:00
weight: 70
slug: builder-factory
tags: ["创建型"]
categories: ["design-pattern"]
author: "nicky_chin"
comments: true
share: true
draft: false
---



**定义**：工厂模式通俗意义上讲就是一个多产品的流程化工厂，每个工厂生产同一系列相关性的组件

**分类**：

按工厂职能划分可以分为三类： 
 简单工厂模式（Simple Factory） 
 工厂方法模式（Factory Method） 
 抽象工厂方法（Abstract Factory）

接下来我们直接通过**uml**图和具体的代码实现以上三类

我们以汽车工厂生产汽车为例，本田工厂假设要生产CIVIC和CRV两种车型，那么我们该怎么去设计实现

**1 简单工厂模式**

![简单工厂模式](http://upload-images.jianshu.io/upload_images/10175660-4012e2250133cb61?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

工厂产品线流程如上图所示：工厂生产汽车通过指定汽车的编号，我们就可以走指定的产品线；调用者只需要选择具体车型而不需要内部车是怎么制造出来的

简单工厂模式主要包括三部分： 
工厂角色：上图中的HONDAFactroy 生产车型用 
抽象产品角色：上图中的HONDA和HONDACar 包含通用的属性和方法 
具体产品角色：上图中的CIVIC和CRV，具体的车型包含各种参数

**代码如下**
```
/** 
* @author nicky_chin [shuilianpiying@163.com] 
* @since –created on 2017/12/27 at 11:11 
*/ 
public class CIVIC extends HONDACar implements HONDA {

private String carName;

private Double price;

public CIVIC() {
    this.carName = "10代思域";
    this.price = 158000.9;
}

@Override
public String introduceCar() {
    return "CIVIC{" + "carName='" + carName + '\'' + ", price=" + price + "} " + super.toString();
}

@Override
public void salePlace() {
    System.out.println("余杭区东本销售旗舰店");
}

}

/** 
* @author nicky_chin [shuilianpiying@163.com] 
* @since –created on 2017/12/27 at 11:12 
*/ 
public class CRV extends HONDACar implements HONDA {

private String carName;

private Double price;

public CRV() {
    carName = "本田crv";
    price = 290000.8;
}

@Override
public void salePlace() {
    System.out.println("西湖东本顺风旗舰店");
}

@Override
public String introduceCar() {
    return "CRV{" + "carName='" + carName + '\'' + ", price=" + price + "} " + super.toString();

}

}
```

```
public interface HONDA {

String introduceCar();
}

/** 
* @author nicky_chin [shuilianpiying@163.com] 
* @since –created on 2017/12/27 at 11:15 
*/ 
public abstract class HONDACar implements HONDA {

//供应商
private String supplier;

//税率
private Double rate;

public HONDACar() {
    supplier = "广州";
    rate = 7.0;
}

public final String getSupplier() {
    return this.supplier;
}

public final Double getRate() {
    return this.rate;
}

public abstract void salePlace();

@Override
public String toString() {
    return "HONDACar{" + "supplier='" + supplier + '\'' + ", 税率rate=" + rate + '}';
}

}


public class FactoryHONDA {

public static final int TYPE_CIVIC = 1;

public static final int TYPE_CRV = 2;

public static HONDA produceCar(int type) {
    switch (type) {
        case TYPE_CIVIC:
        return new CIVIC();
    case TYPE_CRV:
        return new CRV();
    }
    return null;
}
}
```

**分析** 
这种工厂方法不符合开闭原则，因为增加车型，需要在HONDAFactory中修改具体的代码，我们可以通过反射的方式动态加载类避免这种问题

**2 工厂方法模式**

 一个抽象产品，可以派生多个具体产品 
 一个抽象工厂，可以派生多个具体工厂 
 每个具体工厂创建一个产品线

![工厂方法模式](http://upload-images.jianshu.io/upload_images/10175660-922ce03d6a042ced?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

如上图所示，工厂方法则有多个工厂实例，每个工厂负责一条流水线

工厂方法模式主要包括四部分： 
抽象工厂角色：上图中的HONDAFactory，是具体工厂公共部分 
具体工厂角色：上图中的CIVICFactory和CRVFactory 
抽象产品角色：上图中的HONDA和HONDACar 包含通用的属性和方法 
具体产品角色：上图中的CIVIC和CRV，具体的车型包含各种参数

**代码如下**
```
public class CIVICFactory extends HONDAFactory {

@Override
public HONDA produceCar() {
    return new CIVIC();
}

} 
public class CRVFactory extends HONDAFactory{

@Override
public HONDA produceCar() {
    return new CRV();
}

} 
public abstract class HONDAFactory {

public abstract HONDA produceCar();

} 
/** 
* @author nicky_chin [shuilianpiying@163.com] 
* @since –created on 2017/12/27 at 11:39 
*/ 
public class HONDACustomer {

public static void main(String[] args) {
    Scanner scanner = new Scanner(System.in);
    System.out.println("请看你想要买的车");
    System.out.println("CIVIC");
    System.out.println("CRV");
    String type = scanner.nextLine();
    System.out.println("您选择是：" +type);
    try {
        Class<?> carType = Class.forName("designpattern.factory.factorymethod." + type.toUpperCase() + "Factory");
        Method factoryMtd = carType.getMethod("produceCar");
        HONDA honda = (HONDA)factoryMtd.invoke(carType.newInstance());
        System.out.println(honda.introduceCar());
    } catch (ReflectiveOperationException e) {
            System.out.println("没有该车型");
        }
    }

}

```

分析 
当有新车型生产线时，只需创建具体的工厂类和车型类即可，不需要修改现有代码，符合开闭原则（代码中具体体现为通过反射加载类地址方式获取，如果你需要把地址配置到properties文件中，则可以使用Resorcebundle工具类配合使用，这样更灵活），但是如果工厂只是单生产线，那么新增车型越多工厂越多，越多越繁琐

3抽象工厂方法

 多个抽象产品，每个抽象产品有多个具体产品类 
 一个抽象工厂，有多个具体工厂 
 每个具体工厂可以创建多个具体产品实例

uml图就不画了，只是在HONDAFactroy中加入多个产品线的方法 
抽象工厂模式的工作流程和工厂方法模式的工作流程基本相似，唯一不同是一个工厂生产多个组件 
我们以生产该类型汽车的同时还可以生产该类型的车毂（wheel）作为例子

代码
```
public class CIVICFactory implements HONDAFactory {

@Override
public HONDA produceCar() {
    return new CIVIC();
}

@Override
public Wheel produceWheel() {
    return new CIVICWheel();
}

}

public class CRVFactory implements HONDAFactory {

@Override
public HONDA produceCar() {
    return new CRV();
}

@Override
public Wheel produceWheel() {
    return new CRVWheel();
}

}

ublic interface HONDAFactory {

HONDA produceCar();

Wheel produceWheel();

} 
public final class HONDACustomer {

public static void main(String[] args) {
    Scanner scanner = new Scanner(System.in);
    System.out.println("请看你想要买的车");
    System.out.println("CIVIC");
    System.out.println("CRV");
    String type = scanner.nextLine();
    System.out.println("您选择是：" +type);
    try {
        Class<?> carType = Class.forName("designpattern.factory.abstractfactory." + type.toUpperCase() + "Factory");
        Method carMtd = carType.getMethod("produceCar");
        HONDA honda = (HONDA)carMtd.invoke(carType.newInstance());
        System.out.println(honda.introduceCar());
        Method wheelMtd = carType.getMethod("produceWheel");
        Wheel wheel =(Wheel) wheelMtd.invoke(carType.newInstance());
        wheel.introduce();

    } catch (ReflectiveOperationException e) {
            System.out.println("没有该车型或车毂");
        }
    }

}
```

**分析**

从上代码分析可见，抽象工厂模式应用场景是围绕同一主题的n个系列产品（如汽车和车毂） 抽象工厂模式和工厂方法模式的区别在于需要创建的对象的复杂程度 
、 
**总结**

综上所述，基本可以知道如何使用 
简单工厂：**单工厂多产品线** 
工厂方法：**多工厂单产品线** 
抽象工厂方法：**多工厂多产品线**

根据工厂产品需求选择合适的工厂模式

具体的例子比如 mybatis 的SqlSessionFactory接口 
![SqlSessionFactory](http://upload-images.jianshu.io/upload_images/10175660-2a587ed1bbed05b0?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

有两个具体工厂（SqlSessionManager 和 DefalutSqlSessionFactory） 每个工厂中有 生产SqlSession 和 Configuration 的 流水线 SqlSession 又是抽象产品角色，有很多具体实现

