
---
title: ClassLoader类加载分析（二）
date: 2018-03-20T11:18:15+08:00
weight: 70
slug: classloader-chapter02
tags: ["源码"]
categories: ["Classloader"]
author: "nicky_chin"
comments: true
share: true
draft: false
---



# 一、JVM 提供的 Classloader

## 1.1 BootstrapClassloader

引导类加载器，又称启动类加载器，是最顶层的类加载器，主要用来加载Java核心类，如rt.jar、resources.jar、charsets.jar等，Sun的JVM中，执行java的命令中使用**-Xbootclasspath选项或使用- D选项**指定sun.boot.class.path系统属性值可以指定附加的类，它不是 java.lang.ClassLoader的子类，而是由JVM自身实现的该类c 语言实现，Java程序访问不到该加载器。通过下面代码可以查看该加载器加载了哪些jar包

```
public class MainClass {

    public static void main(String[] args) throws ClassNotFoundException {
        URL[] urls = sun.misc.Launcher.getBootstrapClassPath().getURLs();
        Arrays.stream(urls).map(URL::toExternalForm).forEach(System.out::println);
    }

}
```

执行结果：
file:/C:/java/jdk1.8.0_74/jre/lib/resources.jar
file:/C:/java/jdk1.8.0_74/jre/lib/rt.jar
file:/C:/java/jdk1.8.0_74/jre/lib/sunrsasign.jar
file:/C:/java/jdk1.8.0_74/jre/lib/jsse.jar
file:/C:/java/jdk1.8.0_74/jre/lib/jce.jar
file:/C:/java/jdk1.8.0_74/jre/lib/charsets.jar
file:/C:/java/jdk1.8.0_74/jre/lib/jfr.jar
file:/C:/java/jdk1.8.0_74/jre/classes，
写到这里大家应该都知道，我们并没有在classpath里面指定这些类的路径，为啥还是能被加载到jvm并使用起来了吧，因为这些是bootstarp来加载的。

## 1.2 ExtClassloader

扩展类加载器，主要负责加载Java的扩展类库，默认加载JAVA_HOME/jre/lib/ext/目下的所有jar包或者**由java.ext.dirs系统属性**指定的jar包。放入这个目录下的jar包对所有AppClassloader都是可见的（后面会知道ExtClassloader是AppClassloader的父加载器)。那么ext都是在那些地方加载类内：

```
System.out.println(System.getProperty("java.ext.dirs"));
```
C:\java\jdk1.8.0_74\jre\lib\ext;C:\WINDOWS\Sun\Java\lib\ext
## 1.3 AppClassloader

系统类加载器，又称应用加载器，本文说的SystemClassloader和APPClassloader是一个东西，它负责在JVM启动时，加载来自在命令java中的-classpath或者**java.class.path系统属性或者 CLASSPATH**操作系统属性所指定的JAR类包和类路径。调用ClassLoader.getSystemClassLoader()可以获取该类加载器。如果没有特别指定，则用户自定义的任何类加载器都将该类加载器作为它的父加载器,这点通过ClassLoader的无参构造函数可以知道如下：

```
 protected ClassLoader() {        this(checkCreateClassLoader(), getSystemClassLoader());
    }
```

执行以下代码即可获得classpath加载路径：

```
System.out.println(System.getProperty("java.class.path"));
```



## 1.4 Java中如何构造三种类加载器的结构

下面从源码来分析下JVM是如何构建内置classloader的，具体是rt.jar包里面sun.misc.Launcher类：

```
public class Launcher {

private static Launcher launcher = new Launcher();
    private static String bootClassPath =
        System.getProperty("sun.boot.class.path");

    public static Launcher getLauncher() {
        return launcher;
    }

    private ClassLoader loader;
public Launcher()  
      {  
        ExtClassLoader localExtClassLoader;  
        try  
        {  //首先创建了ExtClassLoader
          localExtClassLoader = ExtClassLoader.getExtClassLoader();  
        }  
        catch (IOException localIOException1)  
        {  
          throw new InternalError("Could not create extension class loader");  
        }  
        try  
        {  //然后以ExtClassloader作为父加载器创建了AppClassLoader
          this.loader = AppClassLoader.getAppClassLoader(localExtClassLoader);  
        }  
        catch (IOException localIOException2)  
        {  
          throw new InternalError("Could not create application class loader");  
        }  //这个是个特殊的加载器后面会讲到，这里只需要知道默认下线程上下文加载器为appclassloader
        Thread.currentThread().setContextClassLoader(this.loader);  

        ................
      }
```
1. Launcher初始化了ExtClassLoader和AppClassLoader。 
2. Launcher中并没有看见BootstrapClassLoader，但通过System.getProperty("sun.boot.class.path")得到了字符串bootClassPath,这个应该就是BootstrapClassLoader加载的jar包路径。


下面看下ExtClassLoader.getExtClassLoader()的代码

```
static class ExtClassLoader extends URLClassLoader {

        static {
            ClassLoader.registerAsParallelCapable();
        }

public static ExtClassLoader getExtClassLoader()  
      throws IOException  
    {  //可以知道ExtClassLoader类加载路径为java.ext.dirs
      File[] arrayOfFile = getExtDirs();  
      try  
      {  
        (ExtClassLoader)AccessController.doPrivileged(new PrivilegedExceptionAction()  
        {  
          public Launcher.ExtClassLoader run()  
            throws IOException  
          {  
            int i = this.val$dirs.length;  
            for (int j = 0; j < i; j++) {  
              MetaIndex.registerDirectory(this.val$dirs[j]);  
            }  
            return new Launcher.ExtClassLoader(this.val$dirs);  
          }  
        });  
      }  
      catch (PrivilegedActionException localPrivilegedActionException)  
      {  
        throw ((IOException)localPrivilegedActionException.getException());  
      }  
    }  

    private static File[] getExtDirs()  
    {  
      String str = System.getProperty("java.ext.dirs");  
      File[] arrayOfFile;  
      if (str != null)  
      {  
        StringTokenizer localStringTokenizer = new StringTokenizer(str, File.pathSeparator);  

        int i = localStringTokenizer.countTokens();  
        arrayOfFile = new File[i];  
        for (int j = 0; j < i; j++) {  
          arrayOfFile[j] = new File(localStringTokenizer.nextToken());  
        }  
      }  
      else  
      {  
        arrayOfFile = new File[0];  
      }  
      return arrayOfFile;  
    }
```
可以指定-D java.ext.dirs参数来添加和改变ExtClassLoader的加载路径。

下面看下AppClassLoader.getAppClassLoader的代码

```
public static ClassLoader getAppClassLoader(final ClassLoader paramClassLoader)  
      throws IOException  
    {  //可知AppClassLoader类加载路径为java.class.path
      String str = System.getProperty("java.class.path");  
      final File[] arrayOfFile = str == null ? new File[0] : Launcher.getClassPath(str);  

      (ClassLoader)AccessController.doPrivileged(new PrivilegedAction()  
      {  
        public Launcher.AppClassLoader run()  
        {  
          URL[] arrayOfURL = this.val$s == null ? new URL[0] : Launcher.pathToURLs(arrayOfFile);  

          return new Launcher.AppClassLoader(arrayOfURL, paramClassLoader);  
        }  
      });  
    }
```
AppClassLoader加载的就是java.class.path下的路径。


## 1.5 三种加载器联系

![jvm类加载器](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510093029.png)


  自定义的无参加载器的**父类加载器默认是AppClassloader加载器**，而**AppClassloader加载器的父加载器是ExtClassloader**，我们通过下面代码可以验证：

```
public class MainClass {

    public static void main(String[] args) throws ClassNotFoundException {
        System.out.println(ClassLoader.getSystemClassLoader().toString());
        ClassLoader loader = ClassLoader.getSystemClassLoader().getParent();

        ClassLoader classLoader = MainClass.class.getClassLoader();
        System.out.println("MainClass's classLoader is " + classLoader.toString());
        System.out.println("classLoader's parent is " +classLoader..getParent().toString());

       Class aClass = classLoader.loadClass("compare.CompareTest");
        System.err.println(aClass.getClassLoader().toString());
}
}
```
结果如下：
sun.misc.Launcher$AppClassLoader@18b4aac2
sun.misc.Launcher$ExtClassLoader@2a84aee7
MainClass's classLoader is sun.misc.Launcher$AppClassLoader@18b4aac2
classLoader's parent is sun.misc.Launcher$ExtClassLoader@2a84aee7
sun.misc.Launcher$AppClassLoader@18b4aac2
=============================================================
**如上可知 MainClass的类加载器和CompareTest的类加载器指向的都是同一个
AppClassLoader,这是类的默认加载器**


一般我们都认为ExtClassloader的父类加载器是BootStarpClassloader，但是其实他们之间根本是没有父子关系的，只是在ExtClassloader找不到要加载类时候会去委托BootStrap加载器去加载。
通过如下代码可以知道父加载器为null

```
ClassLoader.getSystemClassLoader().getParent().getParent()
 System.out.println(int.class.getClassLoader().toString());
 //System.out.println(String.class.getClassLoader().toString());
```
打印结果：
NPE异常, int基本类型和String类型也无法获取他们的父类
================================================
那么他们到底是怎么被加载的，**答案是BootstrapLoader;Bootstrap ClassLoader是由C++编写的，可以通过通过JNI本地方法调用实现。具体底层代码不做研究，但是可以通过类加载的原理来论证**

## 1.6 类加载器原理

Java类加载器使用的是委托机制，也就是子类加载器在加载一个类时候会让父类来加载，那么问题来了，为啥使用这种方式那?因为这样可以避免重复加载，当父亲已经加载了该类的时候，就没有必要子ClassLoader再加载一次。考虑到安全因素，我们试想一下，如果不使用这种委托模式，那我们就可以随时使用自定义的String来动态替代java核心api中定义的类型，这样会存在非常大的安全隐患，而双亲委托的方式，就可以避免这种情况，因为String已经在启动时就被引导类加载器（Bootstrap ClassLoader）加载，所以用户**自定义的ClassLoader永远也无法加载一个自己写的同包路径的也就是java.lang.String的类，即时改变JDK中ClassLoader搜索类的默认算法,但还是会报java.lang.SecurityException**， 下面我们从源码看如何实现委托机制：

整个流程可以如下图所示： 

![类加载时序图](https://raw.githubusercontent.com/nicky-chen/pic_store/master/20190510093104.png)

================================================================
上面已经详细介绍了加载过程，但具体为什么是这样加载，我们还需要了解几个个重要的方法loadClass()、findLoadedClass()、findClass()、defineClass()。
类加载过程通过debug调试发现 首先会调用**ClassLoader类中的 getSystemClassLoader()** 然后会进入Launcher类，初始化了ExtClassLoader和AppClassLoader 然后 进入loadclass方法

```
protected Class<?> loadClass(Stringname,boolean resolve)  
       throws ClassNotFoundException  
   {  
       synchronized (getClassLoadingLock(name)) {  
           // (1)首先从jvm缓存查找该类 ，检测是否已经加载
           Class c = findLoadedClass(name);           
          if (c ==null) {  
               longt0 = System.nanoTime();  
               try {  
                   //然后委托给父类加载器进行加载
                   if (parent !=null) {  
                      //父加载器不为空则调用父加载器的loadClass
                       c = parent.loadClass(name,false);  
                   } else {  
                   //如果父类加载器为null,则委托给BootStrap加载器加载
                       c = findBootstrapClassOrNull(name);  
                   }  
               } catch (ClassNotFoundExceptione) {  
                   // ClassNotFoundException thrown if class not found  
                   // from the non-null parent class loader  
               }  

               if (c ==null) {  
                   // 若仍然没有找到则调用findclass查找
                   // to find the class.  
                   longt1 = System.nanoTime(); 
                 //父加载器不为空则调用父加载器的loadClass 
                   c = findClass(name);  
                   // this is the defining class loader; record the stats  
                   sun.misc.PerfCounter.getParentDelegationTime().addTime(t1 -t0);  
                   sun.misc.PerfCounter.getFindClassTime().addElapsedTimeFrom(t1);  
                   sun.misc.PerfCounter.getFindClasses().increment();  
               }  
           }  
           if (resolve) {  
               //调用resolveClass()
               resolveClass(c);  
           }  
           return c;  
       }  
   }
```

分析代码知道首先会执行
（1）从jvm缓存查找该类，如何该类之前被加载过，则直接从jvm缓存返回该类，否者看当前类加载器是否有父加载器，如果有的话则委托为父类加载器进行加在
（2）递归调用父类加载器，如果ExtClassLoader也没有加载过，则委托为BootStrapClassloader进行加载，如果还是没有找到，则调用当前Classloader的findclass（String）方法进行查找。
（3）参数resolve又是true的话，那么loadClass()又会调用resolveClass(Class)这个方法来生成最终的Class对象


总结下Java应用启动过程是首先BootstarpClassloader加载rt.jar包里面的sun.misc.Launcher类，而该类内部使用BootstarpClassloader加载器构建和初始化Java中三种类加载和线程上下文类加载器，然后在根据不同场景去使载器去自己的类查找路径去加载类。

## 1.7 自定义ClassLoader 动态加载class
可以通过覆盖ClassLoader的findClass方法或者覆盖loadClass方法来实现。

```
public class ProxyDriver extends RealDriver implements Driver {

    @Override
    public void driveCar() {
        System.out.println("帮客户加满油");
    }

}

public class RealDriver{

    public void say() {
        System.out.println("say : " + Instant.now().toEpochMilli());

    }
}

public interface Driver {

    void driveCar();

}

```
1通过覆盖 loadClass方法
```
public class MyClassLoader extends ClassLoader {

    public MyClassLoader(ClassLoader parent) {
        super(parent);
    }

    @Override 
    public Class loadClass(String name) throws ClassNotFoundException {

        if (!"classloader.ProxyDriver".equals(name)) {
            return super.loadClass(name);
        }

        try {

            String path = "E:/totalpalce/excelTest/target/classes/classloader/ProxyDriver.class";

            byte[] classData = Files.readAllBytes(Paths.get(path));

            return defineClass("classloader.ProxyDriver", classData, 0, classData.length);

        } catch (IOException e) {
            e.printStackTrace();
        }

        return null;

    }

    public static void main(String[] args)
            throws ClassNotFoundException, IllegalAccessException, InstantiationException {

        //类加载
        ClassLoader parentClassLoader = MyClassLoader.class.getClassLoader();
        MyClassLoader classLoader = new MyClassLoader(parentClassLoader);
        Class myObjectClass = classLoader.loadClass("classloader.ProxyDriver");

        Driver object1 = (Driver) myObjectClass.newInstance();
        object1.driveCar();

        RealDriver object2 = (RealDriver) myObjectClass.newInstance();
        object2.say();

        //类重载
        classLoader = new MyClassLoader(parentClassLoader);

        myObjectClass = classLoader.loadClass("classloader.ProxyDriver");

        object1 = (Driver) myObjectClass.newInstance();
        object1.driveCar();

        object2 = (RealDriver) myObjectClass.newInstance();
        object2.say();

    }
```
2 通过findClass()
```
public class PathClassLoader extends ClassLoader {

   //要创建用户自己的类加载器，只需要继承java.lang.ClassLoader类，然后覆盖它的findClass(String name)方法即可，即指明如何获取类的字节码流。

    //如果要符合双亲委派规范，则重写findClass方法（用户自定义类加载逻辑）；要破坏的话，重写loadClass方法(双亲委派的具体逻辑实现)

    private String classPath;

    public PathClassLoader(String classPath) {
        this.classPath = classPath;
    }

    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        System.out.println("---------");
        byte[] classData = getData(name);
        if (classData == null) {
            throw new ClassNotFoundException();
        } else {
            return defineClass(name, classData, 0, classData.length);
        }
    }

    private byte[] getData(String className) {
        String path = classPath + File.separatorChar + className.replace('.', File.separatorChar) + ".class";
        try {
            return Files.readAllBytes(Paths.get(path));
        } catch (IOException e) {
            e.printStackTrace();
        }
        return null;
    }

    public static void main(String args[]) throws ClassNotFoundException, InstantiationException, IllegalAccessException {
        PathClassLoader pcl = new PathClassLoader("E:\\totalpalce\\excelTest\\target\\classes");
        Class c = pcl.findClass("compare.CompareTest");//注意要包括包名
        System.out.println(c.newInstance());//打印类加载成功.
    }

}

```
建议使用findClass()方法。这用不会破坏类加载的的双亲委托机制


源码地址：http://www.grepcode.com/file/repository.grepcode.com/java/root/jdk/openjdk/8u40-b25/sun/misc/Launcher.java
