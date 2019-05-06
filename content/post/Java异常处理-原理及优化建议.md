Title: Java异常处理-原理及优化建议
Date: 2018-04-17 19:00
Tags: 基础
Category: java-base
Slug: exception-introduce



# 1 异常层次结构
异常指不期而至的各种状况，如：文件找不到、网络连接失败、非法参数等。异常是一个事件，它发生在程序运行期间，干扰了正常的指令流程。Java通 过API中Throwable类的众多子类描述各种不同的异常。因而，Java异常都是对象，是Throwable子类的实例，描述了出现在一段编码中的 错误条件。当条件生成时，错误将引发异常。
      Java异常类层次结构图：
![Java异常类层次结构图](https://upload-images.jianshu.io/upload_images/10175660-248cd3eb6352bfb8.jpg?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

  在 Java 中，所有的异常都有一个共同的祖先 Throwable（可抛出）。Throwable 指定代码中可用异常传播机制通过 Java 应用程序传输的任何问题的共性。
       **Throwable**： 有两个重要的子类：*Exception（异常）和 Error（错误）*，二者都是 Java 异常处理的重要子类，各自都包含大量子类。
       **Error**（错误）:是程序无法处理的错误，表示运行应用程序中较严重问题。大多数错误与代码编写者执行的操作无关，而表示代码运行时 JVM（Java 虚拟机）出现的问题。例如，Java虚拟机运行错误（Virtual MachineError），当 JVM 不再有继续执行操作所需的内存资源时，将出现 OutOfMemoryError。这些异常发生时，Java虚拟机（JVM）一般会选择线程终止。这些错误表示故障发生于虚拟机自身、或者发生在虚拟机试图执行应用时，如Java虚拟机运行错误（Virtual MachineError）、类定义错误（NoClassDefFoundError）等。这些错误是不可查的，因为它们在应用程序的控制和处理能力之 外，而且绝大多数是程序运行时不允许出现的状况。对于设计合理的应用程序来说，即使确实发生了错误，本质上也不应该试图去处理它所引起的异常状况。在 Java中，错误通过Error的子类描述。

**Exception**（异常）:是程序本身可以处理的异常。
Exception 类有一个重要的子类 RuntimeException。RuntimeException 类及其子类表示“JVM 常用操作”引发的错误。例如，若试图使用空值对象引用、除数为零或数组越界，则分别引发运行时异常（NullPointerException、ArithmeticException）和 ArrayIndexOutOfBoundException。

 通常，Java的异常(包括Exception和Error)分为可查的异常（checked exceptions）和不可查的异常（unchecked exceptions）。 

 >运行时异常：都是RuntimeException类及其子类异常，如NullPointerException(空指针异常)、IndexOutOfBoundsException(下标越界异常)等，这些异常是不检查异常，程序中可以选择捕获处理，也可以不处理。这些异常一般是由程序逻辑错误引起的，程序应该从逻辑角度尽可能避免这类异常的发生。
运行时异常的特点是Java编译器不会检查它，也就是说，当程序中可能出现这类异常，即使没有用try-catch语句捕获它，也没有用throws子句声明抛出它，也会编译通过。

>非运行时异常 （编译异常）：是RuntimeException以外的异常，类型上都属于Exception类及其子类。从程序语法角度讲是必须进行处理的异常，如果不处理，程序就不能编译通过。如IOException、SQLException等以及用户自定义的Exception异常，一般情况下不自定义检查异常。


# 2 JVM字节码分析异常处理机制

我们都知道 try、catch、finally语句块的执行顺序:
![try-catch-finally 控制流](https://upload-images.jianshu.io/upload_images/10175660-0f52d611affd9a6f.jpg?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)



接下来我们从字节码的角度加深对异常机制的理解，
我们先反编译如下代码：
```
public class FileDemo {

    private static void divideFun(int a, int b) {
        b = a - b;
    }

    public static void main(String[] args) {
        int a = 1;
        int b = 3;
        try {
            b = a + b;
            FilterInputStream filterInputStream = new BufferedInputStream(new FileInputStream("d:/a"));
        } catch (FileNotFoundException e) {
            System.out.println("file error");
            divideFun(a, b);
        } catch (RuntimeException e) {
            b = a * b;
            throw e;
        } finally {
            a = 0;
        }

    }

}
```
通过命令javap -c .\FileDemo.class 反编译.class文件得到一下输出：
```
PS E:\totalpalce\ContentTest\target\classes\exception> javap -c .\FileDemo.class
Compiled from "FileDemo.java"
public class exception.FileDemo {
  public exception.FileDemo();
    Code:
       0: aload_0  //从局部变量0中装载引用类型值
       1: invokespecial #1  // Method java/lang/Object."<init>":()V 根据编译时类型来调用实例方法
       4: return   //从方法中返回，返回值为void

  public static void main(java.lang.String[]);
    Code:
       0: iconst_1    //将int类型常量1压入栈
       1: istore_1    //将int类型值存入局部变量1  a = 1
       2: iconst_3    //将int类型常量3压入栈
       3: istore_2    //将int类型值存入局部变量2  b = 3

       4: iload_1     //从局部变量1中装载int类型值  异常语句块 start
       5: iload_2     //从局部变量2中装载int类型值
       6: iadd        // 执行int类型的加法    a + b
       7: istore_2    //将int类型值存入局部变量2  b = a + b
       8: new           #2   //创建一个新对象  class java/io/BufferedInputStream
      11: dup         //复制栈顶部一个字长内容
      12: new           #3   // 创建一个新对象 class java/io/FileInputStream
      15: dup         //复制栈顶部一个字长内容
      16: ldc           #4   //把常量池中的 "d:/a" 压入栈
      18: invokespecial #5   //根据编译时类型来调用实例方法 Method java/io/FileInputStream."<init>":(Ljava/lang/String;)V
      21: invokespecial #6   //根据编译时类型来调用实例方法 Method java/io/BufferedInputStream."<init>":(Ljava/io/InputStream;)V
      24: astore_3    //将引用类型值存入局部变量3
      25: iconst_0    //将int类型常量0压入栈  异常语句块 end

      26: istore_1    //将int类型值存入局部变量1  finally语句块 a = 0
      27: goto          63   //无条件跳转至63

      //碰到 FileNotFoundException时，跳到 30 号指令
      30: astore_3    //将引用类型值存入局部变量3
      31: getstatic     #8   //从类中获取静态字段  Field java/lang/System.out:Ljava/io/PrintStream;
      34: ldc           #9   // 把常量池中的"file error"压入栈
      36: invokevirtual #10  //运行时按照对象的类来调用实例方法 Method java/io/PrintStream.println:(Ljava/lang/String;)V
      39: iload_1     //从局部变量1中装载int类型值
      40: iload_2     //从局部变量2中装载int类型值
      41: invokestatic  #11  // 调用类（静态）方法  Method divideFun:(II)V
      44: iconst_0    //将int类型常量0压入栈
      45: istore_1    //将int类型值存入局部变量1 finally语句块 a = 0
      46: goto          63   //无条件跳转至63

      //碰到 RuntimeException时，跳到 49 号指令
      49: astore_3    //将引用类型值存入局部变量3
      50: iload_1     //从局部变量1中装载int类型值
      51: iload_2     //从局部变量2中装载int类型值
      52: imul        //执行int类型的乘法 a*b
      53: istore_2    //将int类型值存入局部变量2  b = a * b
      54: aload_3     //从局部变量3中装载引用类型值
      55: athrow      //抛出异常或错误 throw e

      //其他未捕获异常时候，跳到 56 号指令
      56: astore        4  // 将引用类型或returnAddress类型值存入局部变量
      58: iconst_0    //将int类型常量0压入栈
      59: istore_1    //将int类型值存入局部变量1 finally语句块 a = 0
      60: aload         4  //从局部变量中装载引用类型值（refernce）
      62: athrow      //抛出异常或错误
      63: return      //从方法中返回，返回值为void
    Exception table:  // 异常表
       from    to  target type
           4    25    30   Class java/io/FileNotFoundException //4-25号指令中，碰到 FileNotFoundException时，跳到 30 号指令
           4    25    49   Class java/lang/RuntimeException
           4    25    56   any
          30    44    56   any
          49    58    56   any

```
通过以上指令，我们能够理解，生成字节码指令的时候，会有一张异常表，记录发生异常情况，跳转到哪一条指令，捕获的异常会在字节码指令中跟踪 try语句块中的代码，当出现该异常的时候跳转到相应catch内部的语句块和最后的finally语句块，如果出现的异常是我们未捕获的，则会走finally的逻辑，并抛出异常错误返回

为了更好的理解我们可以看下面字节码指令结构图：
![异常字节码指令图](https://upload-images.jianshu.io/upload_images/10175660-f388282f852fc14f.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

# 3 Java异常处理的一般性建议
>try-catch-finally 规则 异常处理语句的语法规则：
>1)  必须在 try 之后添加 catch 或 finally 块。try 块后可同时接 catch 和 finally 块，但至少有一个块。
>2) 必须遵循块顺序：若代码同时使用 catch 和 finally 块，则必须将 catch 块放在 try 块之后。
>3) catch 块与相应的异常类的类型相关。
>4) 一个 try 块可能有多个 catch 块。若如此，则执行第一个匹配块。即Java虚拟机会把实际抛出的异常对象依次和各个catch代码块声明的异常类型匹配，如果异常对象为某个异常类型或其子类的实例，就执行这个catch代码块，不会再执行其他的 catch代码块
>5) 可嵌套 try-catch-finally 结构。
>6) 在 try-catch-finally 结构中，可重新抛出异常。
>7) 除了下列情况，总将执行 finally 做为结束：JVM 过早终止（调用 System.exit(int)）；在 finally 块中抛出一个未处理的异常；计算机断电、失火、或遭遇病毒攻击。

> Throws抛出异常的规则：
 >1) 如果是不可查异常（unchecked exception），即Error、RuntimeException或它们的子类，那么可以不使用throws关键字来声明要抛出的异常，编译仍能顺利通过，但在运行时会被系统抛出。
>2) 必须声明方法可抛出的任何可查异常（checked exception）。即如果一个方法可能出现受可查异常，要么用try-catch语句捕获，要么用throws子句声明将它抛出，否则会导致编译错误
>3) 仅当抛出了异常，该方法的调用者才必须处理或者重新抛出该异常。当方法的调用者无力处理该异常的时候，应该继续抛出，而不是囫囵吞枣。
 >4) 调用方法必须遵循任何可查异常的处理和声明规则。若覆盖一个方法，则不能声明与覆盖方法不同的异常。声明的任何异常必须是被覆盖方法所声明异常的同类或子类。

# 4 异常处理优化

##### 4. 1 Java7中IO的异常处理 try-with-resource
try-with-resources语句是一种声明了一种或多种资源的try语句。资源是指在程序用完了之后必须要关闭的对象。try-with-resources语句保证了每个声明了的资源在语句结束的时候都会被关闭。任何实现了java.lang.AutoCloseable接口的对象，和实现了java.io.Closeable接口的对象，都可以当做资源使用。
```
public class FileHandlerOptimize {

    private static void printFile() throws IOException {
        InputStream input = null;

        try {
            input = new FileInputStream("D:/user.txt");

            int data = input.read();
            while (data != -1) {
                System.out.print((char) data);
                data = input.read();
            }
        } finally {
            if (input != null) {
                input.close();
            }
        }
    }

    //单个流关闭
    private static void printFileJava7() throws IOException {

        try (FileInputStream input = new FileInputStream("D:/user.txt")) {

            int data = input.read();
            while (data != -1) {
                System.out.print((char) data);
                data = input.read();
            }
        }
    }

    //如果需要对多个流自动关闭
    private static void printFileJava7Multiple() throws IOException {
//你可以在一个try-with-resources语句里面声明多个资源
        try (FileInputStream input = new FileInputStream("D:/user.txt");
                BufferedInputStream bufferedInput = new BufferedInputStream(input)) {

            int data = bufferedInput.read();
            while (data != -1) {
                System.out.print((char) data);
                data = bufferedInput.read();
            }
        }
    }

    public static void main(String[] args) throws Exception {
        //单个流处理
        printFileJava7();
        //多个流处理
        printFileJava7Multiple();
    }
}
```
这是java7的新特性比较简单，但是它做了一定的优化,你反编译.class文件会发现新增了一行代码如下：
```
    private static void printFileJava7() throws IOException {
        FileInputStream input = new FileInputStream("D:/user.txt");
        Throwable var1 = null;
        try {
            for(int data = input.read(); data != -1; data = input.read()) {
                System.out.print((char)data);
            }
        } catch (Throwable var10) {
            var1 = var10;
            throw var10;
        } finally {
            if (input != null) {
                if (var1 != null) {
                    try {
                        input.close();
                    } catch (Throwable var9) {
                        var1.addSuppressed(var9);
                    }
                } else {
                    input.close();
                }
            }
        }
    }
```
多了 *var1.addSuppressed(var9);* 这行代码，从Java 1.7开始，大佬们为Throwable类新增了addSuppressed方法，支持将一个异常附加到另一个异常身上，从而当出现两个以上的异常时，避免异常被屏蔽覆盖
#####  4.2 Java异常处理模板
对如下代码进行优化：
```
    public static void readFile() throws IOException {
        byte[] buff = new byte[1024];
        FileInputStream input = null;
        try {
            input = new FileInputStream(new File("D:/user.txt"));
            while (-1 != input.read(buff)) {
                System.out.println(new String(buff));
            }
        } catch (IOException e) {
            e.getMessage();
            throw e;
        } finally {
            if (null != input) {
                try {
                    input.close();
                } catch (IOException e) {
                    e.getMessage();
                    throw e;
                }
            }
        }
    }
```
注意: 上面的例子实际上存在异常丢失的隐患, 如果第一个try中出现异常, 接着在执行finally中的input.close()也出现异常, 这时main 方法只能接收到input.close的异常信息, 第一个异常会被覆盖, 导致异常信息丢失

所以正确的写法如下:
```
public class FileReadDemo {  
    public void readFile() throws ApplicationException {  
        byte[] buff = new byte[1024];  
        IOException processException = null;  
        FileInputStream input = null;  
        try {  
            input = new FileInputStream(new File("D:/user.txt"));  
            while (-1 != input.read(buff)) {  
                System.out.println(new String(buff));  
            }  
        } catch (IOException e) {  
            processException = e;  
        } finally {  
            try {  
                if(null != input){  
                    input.close();  
                }  
            } catch (IOException e) {  
                if(null == processException){  
                    throw new ApplicationException(e);  
                }else{  
                    throw new MyException("FileInputStream close exception", processException);  
                }  
            }  
            if(processException !=null){  
                throw new MyException(processException);  
            }  
        }  
          
    }  
  
    public static void main(String[] args){  
        try {  
            readFile();  
        } catch (ApplicationException e) {  
            e.printStackTrace();  
        }  
          
    }  
}  
```
这种写法是不是很糟糕, 我们实际关注的代码就只是第一个try中的四行代码, 这样的缺陷很明显, 一旦系统中有多处地方要用到类似的文件处理操作时, 就需要重复的做try-catch-finally, 很明显, 这就违背了程序开发中的一个重要原则: DRY(Don’t repeat yourself), 代码重复, 不容易阅读和维护, 同时也存在一个隐患, 忘记关闭, 异常没正确处理等, 引入模板方法就可以很好的解决这个问题.
```
public class MyException extends RuntimeException {

    public MyException() {
        super();
    }

    public MyException(String message) {
        super(message);
    }

    public MyException(String message, Throwable cause) {
        super(message, cause);
    }

    public MyException(Throwable cause, String message) {
        super(message, cause);

    }

    public MyException(Throwable suppressed, Throwable throwable, String message) {
        super(message, throwable);
//多异常覆盖问题
        throwable.addSuppressed(suppressed);
    }

    public MyException(Throwable cause) {
        super(cause);
    }

    protected MyException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
        super(message, cause, enableSuppression, writableStackTrace);
    }
}
```
提取重复代码
```
public abstract class InputStreamProcessingTemplate {

    public void process(String fileName) {
        //防止异常信息丢失
        IOException processException = null;
        InputStream input = null;
        try {
            input = new FileInputStream(fileName);

            doProcess(input);
        } catch (IOException e) {
            processException = e;
        } finally {
            processExceptionHandle(fileName, processException, input);
        }
    }

    //override this method in a subclass, to process the stream.
    public abstract void doProcess(InputStream input) throws IOException;

    private static void processExceptionHandle(String fileName, IOException processException, InputStream input) {
        if (input != null) {
            try {
                input.close();
            } catch (IOException e) {
                if (processException != null) {
                    //防止异常信息丢失
                    throw new MyException(processException, e, "Error message..." + fileName);
                }
                throw new MyException(e, "Error closing InputStream for file " + fileName);
            }
        }
        if (processException != null) {
            throw new MyException(processException, "Error processing InputStream for file " + fileName);
        }
    }
}
```

通过这种方式，我们发现我们需要处理逻辑，不需要考虑流的关闭问题
```
public class Test {

    public static void main(String[] args) {
        new InputStreamProcessingTemplate(){
            @Override
            public void doProcess(InputStream input) throws IOException {
                byte[] buff = new byte[1024];
                while(input.read(buff) != -1){
                    //do something with the chars...
                    System.out.println(new String(buff));
                }
            }
        }.process("D:\\user.txt");
    }
}
```
或者使用静态模板方法
```
public interface InputStreamProcessor {

    public void process(InputStream input) throws IOException;

}
```
静态方法
```
public class InputStreamProcessingTemplate {

    public static void process(String fileName, InputStreamProcessor processor) {
        //防止异常信息丢失
        IOException processException = null;
        InputStream input = null;
        try {
            input = new FileInputStream(fileName);
            processor.process(input);
        } catch (IOException e) {
            processException = e;
        } finally {
            processExceptionHandle(fileName, processException, input);

        }
    }

    private static void processExceptionHandle(String fileName, IOException processException, InputStream input) {
        if (input != null) {
            try {
                input.close();
            } catch (IOException e) {
                if (processException != null) {
                    //防止异常信息丢失
                    throw new MyException(processException, e, "Error message..." + fileName);
                }
                throw new MyException(e, "Error closing InputStream for file " + fileName);
            }
        }
        if (processException != null) {
            throw new MyException(processException, "Error processing InputStream for file " + fileName);
        }
    }
}
```

这样看上出代码更加简洁优雅
```
public class Test {

    public static void main(String[] args) {
        InputStreamProcessingTemplate.process("D:\\user.txt", input -> {
            byte[] buff = new byte[1024];
            while(input.read(buff) != -1){
                //do something with the chars...
                System.out.println(new String(buff));
            }
        });
    }
}
```
##### 4.3 java8中的异常简化
实现 Supplier<T> 提供型接口
```
public class MyException extends RuntimeException implements Supplier<RuntimeException> {

    public MyException() {
        super();
    }

    public MyException(String message) {
        super(message);
    }

    public MyException(String message, Throwable cause) {
        super(message, cause);
    }

    public MyException(Throwable cause, String message) {
        super(message, cause);

    }

    public MyException(Throwable suppressed, Throwable throwable, String message) {
        super(message, throwable);
        throwable.addSuppressed(suppressed);
    }

    public MyException(Throwable cause) {
        super(cause);
    }

    protected MyException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
        super(message, cause, enableSuppression, writableStackTrace);
    }

    @Override public RuntimeException get() {
        return this;
    }
```
如此我们可以简化我们的NPE判断
原先我们都是这样
```
if (user == null) {
            throw new MyException();
        }
if (user.getAge() == null) {
            throw new MyException();
        }
```
现在可以这样
```
Optional.ofNullable(Optional.ofNullable(user).orElseThrow(MyException::new).getAge()).orElseThrow(MyException::new);
```
##### 4.4 异常增强
我们在平时的软件开发中一般都是进行异常包装，包括其中的 错误码 和 错误信息，
来提示我们程序错误的原因，例如下面例子：
```
public void method3() throws EnrichableException{
     try{
        method1(); 
     } catch(EnrichableException e){
        e.addInfo("An error occurred when trying to ...");
        throw e;
     }
  }

  public void method2() throws EnrichableException{
     try{
        method1(); 
     } catch(EnrichableException e){
        e.addInfo("An error occurred when trying to ...");
        throw e;
     }
  }
  
  public void method1() throws EnrichableException {
     if(...) throw new EnrichableException(
        "ERROR1", "Original error message");   
  }
```
方法method1抛出一个异常，通过唯一的错误码标识“ERROR1”。请注意，method1（）被method2（）和method3（）调用。尽管在method1（）方法中，进行了异常信息记录，但是无论在方法method2和method3中运行的时候method1出错，封装的错误结果都是相同的，但是对于开发人员来说，确定是具体是哪一个方法出的问题这可能很重要。错误码“ERROR1”足以确定错误发生在哪里，但不知道在哪个上下文中出现的情况。

解决这个问题的方法是在异常中添加唯一的上下文错误代码，就像添加其他上下文信息一样。这里有一个例子，addInfo（）方法已经被更改以适应以下情况
```
public void method3() throws EnrichableException{
     try{
        method1(); 
     } catch(EnrichableException e){
        e.addInfo("METHOD3", "ERROR1",
            "An error occurred when trying to ...");
        throw e;
     }
  }

  public void method2() throws EnrichableException{
     try{
        method1(); 
     } catch(EnrichableException e){
        e.addInfo("METHOD2", "ERROR1",
            "An error occurred when trying to ...");
        throw e;
     }
  }
  
  public void method1() throws EnrichableException {
     if(...) throw new EnrichableException(
        "METHOD1", "ERROR1", "Original error message");   
  }
```
这样当method1（）从method3（）调用时，错误标识将如下所显示：
```
[METHOD3:ERROR1][METHOD1:ERROR1]
```
我们就可以确定方法出错的位置和调用链

而异常增强，则是有这种需求场景的前提下，通过添加异常调用链信息，追踪问题
代码如下：
异常句柄
```
public interface ExceptionHandler {

    void handle(String contextCode, String errorCode,
            String errorText, Throwable t);

    void raise(String contextCode, String errorCode,
            String errorText);
}
```
异常类
```
public class EnrichableException  extends RuntimeException {

    public static final long serialVersionUID = -1;

    private List<InfoItem> infoItems = new ArrayList<>();

    private class InfoItem {

        private String errorContext;

        private String errorCode;

        private String errorText;

        private InfoItem(String contextCode, String errorCode, String errorText) {

            this.errorContext = contextCode;
            this.errorCode = errorCode;
            this.errorText = errorText;
        }
    }

    public EnrichableException(String errorContext, String errorCode, String errorMessage) {

        addInfo(errorContext, errorCode, errorMessage);
    }

    public EnrichableException(String errorContext, String errorCode, String errorMessage, Throwable cause) {
        super(cause);
        addInfo(errorContext, errorCode, errorMessage);
    }

    public EnrichableException addInfo(String errorContext, String errorCode, String errorText) {

        this.infoItems.add(new InfoItem(errorContext, errorCode, errorText));
        return this;
    }

    public String getCode() {
        StringBuilder builder = new StringBuilder();

        for (int i = this.infoItems.size() - 1; i >= 0; i--) {
            InfoItem info = this.infoItems.get(i);
            builder.append('[');
            builder.append(info.errorContext);
            builder.append(':');
            builder.append(info.errorCode);
            builder.append(']');
        }

        return builder.toString();
    }

    @Override public String toString() {
        StringBuilder builder = new StringBuilder();

        builder.append(getCode());
        builder.append('\n');

        //append additional context information.
        for (int i = this.infoItems.size() - 1; i >= 0; i--) {
            InfoItem info = this.infoItems.get(i);
            builder.append('[');
            builder.append(info.errorContext);
            builder.append(':');
            builder.append(info.errorCode);
            builder.append(']');
            builder.append(info.errorText);
            if (i > 0) {
                builder.append('\n');
            }
        }

        //append root causes and text from this exception first.
        if (getMessage() != null) {
            builder.append('\n');
            if (getCause() == null) {
                builder.append(getMessage());
            } else if (!getMessage().equals(getCause().toString())) {
                builder.append(getMessage());
            }
        }
        appendException(builder, getCause());

        return builder.toString();
    }

    private void appendException(StringBuilder builder, Throwable throwable) {
        if (throwable == null) {
            return;
        }
        appendException(builder, throwable.getCause());
        builder.append(throwable.toString());
        builder.append('\n');
    }

}
```

测试类
```
public class ExceptionTest {
    protected ExceptionHandler exceptionHandler = new ExceptionHandler(){
        @Override
        public void handle(String errorContext, String errorCode,
                String errorText, Throwable t){

            if(! (t instanceof EnrichableException)){
                throw new EnrichableException(
                        errorContext, errorCode, errorText, t);
            } else {
                ((EnrichableException) t).addInfo(
                        errorContext, errorCode, errorText);
            }
        }

        @Override
        public void raise(String errorContext, String errorCode,
                String errorText){
            throw new EnrichableException(
                    errorContext, errorCode, errorText);
        }
    };

    public static void main(String[] args){
        ExceptionTest test = new ExceptionTest();
        try{
            test.level1();
        } catch(Exception e){
            e.printStackTrace();
        }
    }

    public void level1(){
        try{
            level2();
        } catch (EnrichableException e){
            this.exceptionHandler.handle(
                    "L1", "E1", "Error in level 1, calling level 2", e);
            throw e;
        }
    }

    public void level2(){
        try{
            level3();
        } catch (EnrichableException e){
            this.exceptionHandler.handle(
                    "L2", "E2", "Error in level 2, calling level 3", e);
            throw e;
        }
    }

    public void level3(){
        try{
            level4();
        } catch(Exception e){
            this.exceptionHandler.handle(
                    "L3", "E3", "Error at level 3", e);
        }
    }

    public void level4(){
        throw new IllegalArgumentException("incorrect argument passed");
    }
}
```
运行main方法结果如下
>[L1:E1][L2:E2][L3:E3]
[L1:E1]Error in level 1, calling level 2
[L2:E2]Error in level 2, calling level 3
[L3:E3]Error at level 3
java.lang.IllegalArgumentException: incorrect argument passed

我们可以清晰的定位在哪个流程中函数调用出现了异常

#Reference
[Java Exception Handling](http://tutorials.jenkov.com/java-exception-handling/index.html)
[JVM 对 Java 异常的处理原理](https://unmi.cc/jvm-java-handle-try-catch/)
[JAVA异常处理](http://ifeve.com/java-exception/)
[异常管理 - try-catch-finally异常信息丢失](https://blog.csdn.net/piaohai/article/details/50387238)
[深入理解Java try-with-resource](http://www.kissyu.org/2016/10/06/深入理解Java%20try-with-resource/?utm_source=tuicool&utm_medium=referral)
