
---
title: 设计模式之Template模式（模版模式）
date: 2018-05-18T11:18:15+08:00
weight: 70
slug: template
tags: ["行为型"]
categories: ["design-pattern"]
author: "nicky_chin"
comments: true
share: true
draft: false
---


# 1 模式简介
**1.1 模版方法模式的定义：**
模版方法模式在一个方法中定义一个算法的骨架，而将一些步骤延迟到子类中。模版方法使得子类可以在不改变算法结构的情况下，重新定义算法中的某些步骤。

**1.2 结构**
![模版方法](https://upload-images.jianshu.io/upload_images/10175660-4b852101cc35ec28.jpg?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


**1.3 模式的组成**

 ***抽象类（AbstractClass）:*** 定义抽象的原语操作（primitive operation） ，具体的子类将重定义它们以实现一个算法， 实现一个模板方法,定义一个算法的骨架。该模板方法不仅调用原语操作，也调用定义。
***具体子类 （ConcreteClass）:*** 实现原语操作以完成算法中与特定子类相关的步骤。

**1.4 优缺点**

>模版方法模式的优点：
	封装不变部分，扩展可变部分；
	提取公共代码，便于维护；
	行为由父类控制，子类实现。
>
>模版方法模式的缺点：
	每一个不同的实现都需要一个子类来实现，导致类个数增加，使系统更加庞大
>
>模版方法模式的适用场景：
	当类中有多个子类共有的方法
	当有重要的、复杂的方法时，可以考虑作为模板方法

# 2 案例

抽象类
```
@FunctionalInterface
public interface MyPredicate<T> {

    boolean test(T t);

    /**
     *过滤用户
     */
    default List<Employee> filterEmployee(List<Employee> emps, MyPredicate<Employee> mp) {
        List<Employee> list = new ArrayList<>();

        for (Employee employee : emps) {
            if (mp.test(employee)) {
                list.add(employee);
            }
        }

        return list;
    }
}
```
具体子类
```
public class FilterEmployeeForAge implements MyPredicate<Employee>{

	@Override
	public boolean test(Employee t) {
		return t.getAge() <= 35;
	}

}

public class FilterEmployeeForSalary implements MyPredicate<Employee> {

	@Override
	public boolean test(Employee t) {
		return t.getSalary() >= 5000;
	}

}
```
模版模式调用

```
	MyPredicate<Employee> myPredicate = new FilterEmployeeForAge();
		List<Employee> list = myPredicate.filterEmployee(emps, myPredicate);
		for (Employee employee : list) {
			System.out.println(employee);
		}

		System.out.println("------------------------------------------");

		List<Employee> list2 = myPredicate.filterEmployee(emps, new FilterEmployeeForSalary());
		for (Employee employee : list2) {
			System.out.println(employee);
		}
```

Java8中的优化
```
 MyPredicate<Employee> myPredicate = new FilterEmployeeForAge();
		List<Employee> list = myPredicate.filterEmployee(emps, e -> e.getAge() < 36);
		list.forEach(System.out::println);

		System.out.println("------------------------------------------");

		List<Employee> list2 = myPredicate.filterEmployee(emps, (e) -> e.getSalary() >= 5000);
		list2.forEach(System.out::println);
```
java8函数式编程好处是可以减少具体实现类的使用，业务逻辑不复杂的时候可以使用，但接口只能定义一个抽象方法，必须满足函数式接口的定义。


