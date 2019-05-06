Title: ClassLoader类加载分析（一）
Date: 2018-03-08 21:15
Tags: 源码
Category: Classloader
Slug: classloader-chapter01



# 一、什么是Classloader

一个Java程序要想运行起来，首先需要经过编译生成 .class文件，然后创建一个运行环境（jvm）来加载字节码文件到内存运行，而.class 文件是怎样被加载中jvm 中的就是Java Classloader所做的事情。
![class文件执行过程](http://upload-images.jianshu.io/upload_images/10175660-fc4f3b0b39421a8b.jpg?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

那么.class文件什么时候会被类加载器加载到jvm中运行那？比如执行new操作时候，当我们使用Class.forName(“包路径+类名”)，Class.forName(“包路径+类名”,classloader),classloader.loadclass(“包路径+类名”);时候就触发了类加载器去类加载对应的路径去查找*.class,并创建Class对象。

# 类的加载过程
类从被加载到虚拟机内存中开始，到卸载出内存为止，它的整个生命周期包括：

1、装载

2-4、链接 -包括 【验证、准备、解析】

5、初始化

6、使用

7、卸载

其中 链接（Link）又分3个步骤，如图所示。类加载到卸载的生命周期流程图如下：

![类加载过程](http://upload-images.jianshu.io/upload_images/10175660-21b86d1b16b11368.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


**1) 装载：查找并加载类的二进制数据（查找和导入Class文件）**

加载是类加载过程的第一个阶段，在加载阶段，虚拟机需要完成以下三件事情：

1、通过一个类的全限定名来获取其定义的二进制字节流（并没有指明要从一个Class文件中获取，可以从其他渠道，譬如：网络、动态生成、数据库等）。

2、将这个字节流所代表的静态存储结构转化为方法区的运行时数据结构。

3、在Java堆中生成一个代表这个类的java.lang.Class对象，作为对方法区中这些数据的访问入口。

相对于类加载的其他阶段而言，加载阶段（准确地说，是加载阶段获取类的二进制字节流的动作）是可控性最强的阶段，因为开发人员既可以使用系统提供的类加载器来完成加载，也可以自定义自己的类加载器来完成加载。

加载阶段完成后，虚拟机外部的 二进制字节流就按照虚拟机所需的格式存储在方法区之中，而且在Java堆中也创建一个java.lang.Class类的对象，这样便可以通过该对象访问方法区中的这些数据。

**2) 链接（**分3个步骤**）**

**1、验证**：确保被加载的类的正确性

验证是连接阶段的第一步，这一阶段的目的是为了确保Class文件的字节流中包含的信息符合当前虚拟机的要求，并且不会危害虚拟机自身的安全。验证阶段大致会完成4个阶段的检验动作：

**文件格式验证**：验证字节流是否符合Class文件格式的规范；例如：是否以0xCAFEBABE开头、主次版本号是否在当前虚拟机的处理范围之内、常量池中的常量是否有不被支持的类型。

**元数据验证**：对字节码描述的信息进行语义分析（注意：对比javac编译阶段的语义分析），以保证其描述的信息符合Java语言规范的要求；例如：这个类是否有父类，除了java.lang.Object之外。

**字节码验证**：通过数据流和控制流分析，确定程序语义是合法的、符合逻辑的。

**符号引用验证**：确保解析动作能正确执行。

验证阶段是非常重要的，但不是必须的，它对程序运行期没有影响，如果所引用的类经过反复验证，那么可以考虑采用-Xverifynone参数来关闭大部分的类验证措施，以缩短虚拟机类加载的时间。

**2、准备**：为类的静态变量分配内存，并将其初始化为默认值

准备阶段是正式为类变量分配内存并设置类变量初始值的阶段，这些内存都将在方法区中分配。对于该阶段有以下几点需要注意：

1、这时候进行内存分配的仅包括类变量（static），而不包括实例变量，实例变量会在对象实例化时随着对象一块分配在Java堆中。

2、这里所设置的初始值通常情况下是数据类型默认的零值（如0、0L、null、false等），而不是被在Java代码中被显式地赋予的值。

```
l例如在准备阶段，为类变量（static修饰）在方法区中分配内存并设置初始值。
private static int var = 50;

准备阶段完成后，var 值为0，而不是50。在初始化阶段，才会把50赋值给val，但是有个特殊情况：
private static final int var= 50;

在编译阶段会为var生成ConstantValue属性，在准备阶段虚拟机会根据ConstantValue属性将var赋值为50。
```
**3、解析**：把类中的符号引用转换为直接引用

解析阶段是将常量池中的符号引用替换为直接引用的过程，解析动作主要针对类或接口、字段、类方法、接口方法、方法类型、方法句柄和调用限定符7类符号引用进行.。符号引用和直接引用有什么不同？
1、***符号引用*** :使用一组符号来描述所引用的目标，可以是任何形式的字面常量，定义在Class文件格式中。
2、***直接引用*** :可以是直接指向目标的指针、相对偏移量或则能间接定位到目标的句柄。

**3) 初始化：
初始化阶段是执行类构造器<clinit>方法的过程，<clinit>方法由类变量的赋值动作和静态语句块按照在源文件出现的顺序合并而成，该合并操作由编译器完成。
```
public class MuitiThreadInit {

    private static int value = 100;
    static int a = 100;
    static int b = 100;
    static int c;

    static {
        c = a + b;
        System.out.println("it only run once");
    }
}
```
1、<clinit>方法对于类或接口不是必须的，如果一个类中没有静态代码块，也没有静态变量的赋值操作，那么编译器不会生成<clinit>；
2、<clinit>方法与实例构造器不同，不需要显式的调用父类的<clinit>方法，虚拟机会保证父类的<clinit>优先执行；
3、为了防止多次执行<clinit>，虚拟机会确保<clinit>方法在多线程环境下被正确的加锁同步执行，如果有多个线程同时初始化一个类，那么只有一个线程能够执行<clinit>方法，其它线程进行阻塞等待，直到<clinit>执行完成。
4、注意：执行接口的<clinit>方法不需要先执行父接口的<clinit>，只有使用父接口中定义的变量时，才会执行。

**类初始化场景**
虚拟机中严格规定了有且只有5种情况必须对类进行初始化。
```
1）遇到new, getstatic, putstatic, invokestatic 这4条字节码指令时，如果类没有进行过初始化，则需要先触发其初始化。生成这4条指令的最常见的Java代码场景是：使用new关键字实例化对象、读取或赋值一个类的静态字段（被final修饰、已在编译器把结果放入常量池的静态字段除外）的时候，以及调用类的静态方法。

2）使用java.lang.reflect包的方法对类进行反射调用时，如类没有进行初始化，则需先触发其初始化。

3）当初始化一个类的时候，如果发现其父类还没有进行过初始化，则需要先触发其父类的初始化。

4）虚拟机启动时，用户需要指定一个启动类（包含main()方法的类），jvm会先初始化这个主类。

5）当使用jdk1.7动态语言支持时，如果一个java.lang.invoke.MethodHandle实例最后的解析结果REF_getstatic,REF_putstatic,REF_invokeStatic的方法句柄，并且这个方法句柄所对应的类没有进行初始化，则需要先出触发其初始化。

```

类的初始化步骤 / JVM初始化步骤：

1）如果这个类还没有被加载和链接，那先进行加载和链接

2）假如这个类存在直接父类，并且这个类还没有被初始化（注意：在一个类加载器中，类只能初始化一次），那就初始化直接的父类（不适用于接口）

3 ) 假如类中存在初始化语句（如static变量和static块），那就依次执行这些初始化语句。

以下几种情况，不会触发类初始化
**1**、通过子类引用父类的静态字段，只会触发父类的初始化，而不会触发子类的初始化。
```
public class Init {

    public static void main(String[] args){
        System.out.println(Child.a);
    }

}

class Super {
    static int a = 100;
    static {
        System.out.println("Super init！");
    }
}

class Child extends Super {
    static {
        System.out.println("child init！");
    }
}
```
输出结果为：
Super init！
100
**2**、定义对象数组，不会触发该类的初始化。

```
public class Init {

    public static void main(String[] args){
 
        Super[] parents = new Super[10];
    }

}
```

**3**、常量在编译期间会存入调用类的常量池中，本质上并没有直接引用定义常量的类，不会触发定义常量所在的类。
```
class Const {
    static final int A = 100;
    static {
        System.out.println("Const init");
    }
}

public class Init{  
    public static void main(String[] args){  
        System.out.println(Const.A);  
    }  
}
```
输出：
100
说明没有触发类Const的初始化，在编译阶段，Const类中常量A的值100存储到Init类的常量池中，这两个类在编译成class文件之后就没有联系了。

**4**、通过类名获取Class对象，不会触发类的初始化。
```
public class test {
   public static void main(String[] args) throws ClassNotFoundException {
        Class c_dog = Dog.class;
        Class clazz = Class.forName("zzzzzz.Cat");
    }
}

class Cat {
    private String name;
    private int age;
    static {
        System.out.println("Cat is load");
    }
}

class Dog {
    private String name;
    private int age;
    static {
        System.out.println("Dog is load");
    }
}

```
执行结果：Cat is load，所以通过Dog.class并不会触发Dog类的初始化动作。

**5**、通过Class.forName加载指定类时，如果指定参数initialize为false时，也不会触发类初始化，其实这个参数是告诉虚拟机，是否要对类进行初始化。
```
public class test {
   public static void main(String[] args) throws ClassNotFoundException {
        Class clazz = Class.forName("zzzzzz.Cat", false, Cat.class.getClassLoader());
    }
}
class Cat {
    private String name;
    private int age;
    static {
        System.out.println("Cat is load");
    }
}
```
**6**、通过ClassLoader默认的loadClass方法，也不会触发初始化动作
 
```
new ClassLoader(){}.loadClass("zzzzzz.Cat");
```


