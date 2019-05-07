

---
title: Java反射优化之方法句柄
date: 2018-08-22T11:18:15+08:00
weight: 70
slug: java-methodHandler
tags: ["基础"]
categories: ["java-base"]
author: "nicky_chin"
comments: true
share: true
draft: false
---


# 1 简介
java7中为间接调用方法引入了新的api，即 **方法句柄**

方法句柄中包含两个重要的类，_MethodHandle和MethodType_

**MethodHandle**

通过句柄我们可以直接调用该句柄所引用的底层方法。从作用上来看，方法句柄类似于反射中的Method类，是对要执行的方法的一个引用，我们也是通过它来调用底层方法，它调用时有两个方法 `invoke和invokeExact`，后者要求参数类型与底层方法的参数完全匹配，前者则在有出入时做修改如包装类型。

**MethodType**

方法签名不可变对象，是对方法的一个映射，包含返回值和参数类型。在lookup时也是通过它来寻找的。
每个方法句柄都有一个MethodType实例，用来指明方法的返回类型和参数类型。

# 2 简单使用

### 2.1 demo测试
```
public class MethodHandleDemo {
    
    public static void main(String[] args) throws Throwable{
        //参数为返回值类型、参数类型  单个参数
        MethodType methodType = MethodType.methodType(void.class, String.class);
        //声明定义方法句柄，通过lookup对象得到方法句柄，参数为方法所在的类、方法的名称、所匹配的方法签名
        MethodHandle methodHandle = MethodHandles.lookup().findVirtual(Test.class, "testMethod", methodType);
        //调用底层方法
        methodHandle.invoke(Test.class.newInstance(), "hello, world");
        //多个参数
        MethodHandle testMethod = MethodHandles.lookup().findVirtual(Test.class, "testMethod", MethodType.methodType(Object.class, String.class, int.class));
        testMethod.invoke(Test.class.newInstance(), "aa", 1);

        MethodType f3 = MethodType.methodType(Object.class, int.class, int.class);

        //查找静态方法
        MethodHandle aStatic = MethodHandles.lookup().findStatic(Test.class, "add", f3);

        //使用invokeExact调用时，参数类型和返回值类型必须与方法签名的一致
        aStatic.invokeExact(1, 1234);

        //调用静态方法 无法调用private的方法
        //aStatic.invoke( 1, 3);

    }

}
class Test {

    public void testMethod(String str) {
        System.out.println("testMethod : "+str);
    }

    public Object testMethod(String str, int x) {
        System.out.println("string = " + str+ " , int = " + x);
        return x;
    }

   /*private*/ public static Object add(int a, int b) {
        System.out.println("a + b = " + (a + b));
        return a + b;
    }
}
```
整体来说，比使用反射简单写，但是不能调用private方法，未深入了解，所以不清楚。

### 2.2 invoke和invokeExact的区别
      
`invoke`方法允许更加松散的调用方式。它会尝试在调用的时候进行返回值和参数类型的转换工作。这是通过MethodHandle类的`asType`方法来完成的，`asType`方法的作用是把当前方法句柄适配到新的MethodType上面，并产生一个新的方法句柄。当方法句柄在调用时的类型与其声明的类型完全一致的时候，调用`invoke`方法等于调用`invokeExact`方法；否则，invoke方法会先调用`asType`方法来尝试适配到调用时的类型。如果适配成功，则可以继续调用。否则会抛出相关的异常。这种灵活的适配机制，使`invoke`方法成为在绝大多数情况下都应该使用的方法句柄调用方式。

### 2.3 效率比较

```

 //12244 12893 12434 12647 12473
    public void testReflect() throws Exception{
        Test test = new Test();
        Class cls = Test.class;
        Method testMethod = cls.getMethod("testMethod", String.class);
        Instant start = Instant.now();
        for (int i = 0; i < 3_000_000 ; i++) {
            testMethod.invoke(test, "a");
        }
        Instant end = Instant.now();
        Duration between = Duration.between(start, end);
        System.out.println("reflect : " + between.toMillis());
    }

    //10785 11093 10923 11002 11125
    public void testMethodHandle() throws Throwable {
        Test test = new Test();
        MethodType methodType = MethodType.methodType(void.class, String.class);
        MethodHandle testMethod = MethodHandles.lookup().findVirtual(Test.class, "testMethod", methodType);
        Instant start = Instant.now();
        for (int i = 0; i < 3_000_000 ; i++) {
            testMethod.invoke(test, "a");
        }
        Instant end = Instant.now();
        Duration between = Duration.between(start, end);
        System.out.println("method : " + between.toMillis());
    }
```
如上所述，执行testMethod方法3百万次。其中使用反射的5次耗时结果为
```
12244 12893 12434 12647 12473   ms
```
使用方法句柄的结果为：

```
10785 11093 10923 11002 11125 ms
```
总体上看，方法句柄的执行效率要比反射更好



# 3 反射与方法句柄异同

 >1、Reflection和MethodHandle机制本质上都是在模拟方法调用，但是Reflection是在模拟Java代码层次的方法调用，而MethodHandle是在模拟字节码层次的方法调用
>  2、Reflection中的Method对象远比MethodHandle机制中的MethodHandle对象所包含的信息要多。前者是方法在Java一端的全面映像，包含了方法的签名、描述符以及方法属性表中各种属性的Java端表示方式，还包含有执行权限等的运行期信息。而后者仅仅包含着与执行该方法相关的信息。通俗的话说，Reflection是重量级，而MethodHandle是轻量级
 >3、由于MethodHandle是对字节码的方法指令调用的模拟，那理论上虚拟机在这方面做的各种优化（如方法内联），在MethodHandle上也应当可以采用类似思路去支持（但目前实现还不完善）。而通过反射去调用方法则不行
 >4、Reflection API的设计目标是只为Java语言服务的，而MethodHandle则设计为可服务于所有Java虚拟机之上的语言，其中也包括了Java语言
