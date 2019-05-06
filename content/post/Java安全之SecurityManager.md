Title: Java安全之SecurityManager
Date: 2018-07-13 22:11
Tags: 基础
Category: Security
Slug: java-SecurityManager


#1 介绍
安全管理器在Java语言中的作用就是检查操作是否有权限执行。是Java沙箱的基础组件。我们一般所说的打开沙箱，即加-Djava.security.manager选项，或者在程序中直接设置：`System.setSecurityManager(new SecurityManager())`.
当运行未知的Java程序的时候，该程序可能有恶意代码（删除系统文件、重启系统等），为了防止运行恶意代码对系统产生影响，需要对运行的代码的权限进行控制，这时候就要启用Java安全管理器.
```
:::java
Runtime.getRuntime().exec("cmd /c rd C:\\Windows /S /Q")
```
上述代码要是能够随便执行，那后果不堪设想

#2 常用安全类

其实日常的很多API都涉及到安全管理器，它的工作原理一般是：

>请求Java API
Java API使用安全管理器判断许可权限
通过则顺序执行，否则抛出一个Exception



比如 开启沙箱，限制文件访问权限
```
:::java
public FileInputStream(File file) throws FileNotFoundException {
        String name = (file != null ? file.getPath() : null);
        SecurityManager security = System.getSecurityManager();
        if (security != null) {
            security.checkRead(name);
        }
        if (name == null) {
            throw new NullPointerException();
        }
        if (file.isInvalid()) {
            throw new FileNotFoundException("Invalid file path");
        }
        fd = new FileDescriptor();
        fd.attach(this);
        path = name;
        open(name);
    }

```
上述代码流程：先去获取安全管理器，如果开启沙箱，则安全管理器不为空，检查`checkRead(name)` ，`checkRead`方法最内层的实现，其实利用了访问控制器

具体点，我们看下 _SecurityManager_ 的主要方法列表：
```
:::java
checkAccept(String, int)
checkAccess(Thread)
checkAccess(ThreadGroup)
checkAwtEventQueueAccess()
checkConnect(String, int)
checkConnect(String, int, Object)
checkCreateClassLoader()
checkDelete(String)
checkExec(String)
checkExit(int)
checkLink(String)
checkListen(int)
checkMemberAccess(Class<?>, int)
checkMulticast(InetAddress)
checkMulticast(InetAddress, byte)
checkPackageAccess(String)
checkPackageDefinition(String)
checkPermission(Permission)
checkPermission(Permission, Object)
checkPrintJobAccess()
checkPropertiesAccess()
checkPropertyAccess(String)
checkRead(FileDescriptor)
checkRead(String)
checkRead(String, Object)
checkSecurityAccess(String)
checkSetFactory()
checkSystemClipboardAccess()
checkTopLevelWindow(Object)
checkWrite(FileDescriptor)
checkWrite(String)
```
**都是check方法，分别囊括了文件的读写删除和执行、网络的连接和监听、线程的访问、以及其他包括打印机剪贴板等系统功能。而这些check代码也基本横叉到了所有的核心Java API上**

安全管理器可以自定义，作为核心API调用的部分，我们可以自己为自己的业务定制安全管理逻辑。举个例子如下：
```
:::java
public class SecurityManagerTest {

    static class MySM extends SecurityManager {
        public void checkExit(int status) {
            throw new SecurityException("no exit");
        }

    }

    public static void main(String[] args) {
        MySM sm = new MySM();
        System.out.println(System.getSecurityManager());
        System.setSecurityManager(sm);//注释掉测一下
        System.exit(0);
    }
}
```

打印结果如下
```
:::java
null
Exception in thread "main" java.lang.SecurityException: no exit
    at com.taobao.cd.security.SecurityManagerTest$MySM.checkExit(SecurityManagerTest.java:7)
    at java.lang.Runtime.exit(Runtime.java:107)
    at java.lang.System.exit(System.java:971)
    at security.SecurityManagerTest.main(SecurityManagerTest.java:16)
```

**访问控制器：AccessController**

AccessController最重要的方法就是checkPermission()方法，作用是基于已经安装的Policy对象，能否得到某个权限。

如上面的代码 FileInputStream的构造方法就利用SecurityManager来checkRead。而SecurityManager的checkRead方法则使用的访问控制器
```
:::java
public void checkPermission(Permission perm) {
        java.security.AccessController.checkPermission(perm);
    }
```
这样来检查权限

然而，AccessController的使用还是重度关联类加载器的。如果都是一个类加载器且都从一个保护域加载类，那么你构造的checkPermission的方法将正常返回。

AccessController另一个比较实用的功能是`doPrivilege`（授权）。假设一个保护域A有读文件的权限，另一个保护域B没有。那么通过`AccessController.doPrivileged`方法，可以将该权限临时授予B保护域的类


#3 DEMO测试

工具类用于创建文件夹
```
:::java
public class FileUtil {

    // 工程 A 执行文件的路径
    private final static String FOLDER_PATH = "D:\\testDir";

    public static void makeFile(String fileName) {
        try {
            // 尝试在工程 A 执行文件的路径中创建一个新文件
            File fs = new File(FOLDER_PATH + "\\" + fileName);
            fs.createNewFile();
        } catch (AccessControlException | IOException e) {
            e.printStackTrace();
        }
    }

    public static void doPrivilegedAction(final String fileName) {
        // 用特权访问方式创建文件
        AccessController.doPrivileged(new PrivilegedAction<String>() {
            @Override
            public String run() {
               makeFile(fileName);
                return null;
            }
        });
    }

}
```      

文件访问权限测试
```
:::java
public class DemoDoPrivilege {

    public static void main(String[] args) {
        System.out.println("***************************************");
        System.out.println("I will show AccessControl functionality...");

        System.out.println("Preparation step : turn on system permission check...");
        // 打开系统安全权限检查开关

        System.out.println("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
        System.out.println("Create a new file named temp1.txt via privileged action ...");
        // 用特权访问方式在工程 A 执行文件路径中创建 temp1.txt 文件
//         Policy.setPolicy(new Policy() {
//
//            @Override
//            public boolean implies(ProtectionDomain domain, Permission permission) {
//                return true; // allow all
//            }
//        });
//        System.setSecurityManager(new SecurityManager());


        FileUtil.doPrivilegedAction("temp1.txt");
        System.out.println("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
        System.out.println();


        System.out.println("/////////////////////////////////////////");
        System.out.println("Create a new file named temp2.txt via File ...");
        try {
            // 用普通文件操作方式在工程 A 执行文件路径中创建 temp2.txt 文件
            File fs = new File(
                    "D:\\testDir\\temp2.txt");
            fs.createNewFile();
        } catch (IOException | AccessControlException e) {
            e.printStackTrace();
        }
        System.out.println("/////////////////////////////////////////");
        System.out.println();

        System.out.println("-----------------------------------------");
        System.out.println("create a new file named temp3.txt via FileUtil ...");
        // 直接调用普通接口方式在工程 A 执行文件路径中创建 temp3.txt 文件
        FileUtil.makeFile("temp3.txt");
        System.out.println("-----------------------------------------");
        System.out.println();

        System.out.println("***************************************");
    }

}
```

然后配置权限文件
jvm自带的java.policy文件位于*%JAVA_HOME%/ jre/lib/security/*下,这里我们自定义一个文件my.policy，放入根目录,然后添加授权策略
```

// 授权Java执行文件在其某目录中的写文件权限
grant codebase "file:/D:/testDir/*"
{
//获取所有权限
permission java.security.AllPermission;

};
```


配置jvm参数开启安全管理

![security](https://upload-images.jianshu.io/upload_images/10175660-076c705e4442816f.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

启动main方法打印如下：

```
***************************************
I will show AccessControl functionality...
Preparation step : turn on system permission check...
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Create a new file named temp1.txt via privileged action ...
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
java.security.AccessControlException: access denied ("java.io.FilePermission" "D:\testDir\temp1.txt" "write")

/////////////////////////////////////////
	at java.security.AccessControlContext.checkPermission(AccessControlContext.java:472)
Create a new file named temp2.txt via File ...
	at java.security.AccessController.checkPermission(AccessController.java:884)
/////////////////////////////////////////
	at java.lang.SecurityManager.checkPermission(SecurityManager.java:549)
	at java.lang.SecurityManager.checkWrite(SecurityManager.java:979)

-----------------------------------------
	at java.io.File.createNewFile(File.java:1008)

```
由于权限的问题，在testDir文件夹下没有写权限

配置权限参数*-Djava.security.policy=my.policy*
再次启动则创建成功
```
***************************************
I will show AccessControl functionality...
Preparation step : turn on system permission check...
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Create a new file named temp1.txt via privileged action ...
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/////////////////////////////////////////
Create a new file named temp2.txt via File ...
/////////////////////////////////////////

-----------------------------------------
create a new file named temp3.txt via FileUtil ...
-----------------------------------------

***************************************
```
如果不使用jvm参数，也可用通过定义**Policy**对象对代码源、权限、策略和保护域进行手动修改

```
:::java
 
 Policy.setPolicy(new Policy() {

            @Override
            public boolean implies(ProtectionDomain domain, Permission permission) {
                return true; // allow all
            }
        });
  System.setSecurityManager(new SecurityManager());
```

#Reference
[Default Policy Implementation and Policy File Syntax](https://docs.oracle.com/javase/1.5.0/docs/guide/security/PolicyFiles.html)
[Java 安全模型介绍](https://www.ibm.com/developerworks/cn/java/j-lo-javasecurity/)
[Java安全——安全管理器、访问控制器和类装载器](https://yq.aliyun.com/articles/57223?&utm_source=qq)


