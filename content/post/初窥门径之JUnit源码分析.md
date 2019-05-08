
---
title: 初窥门径之JUnit源码分析
date: 2018-07-16T11:18:15+08:00
weight: 70
slug: junit-code=analysis
tags: ["junit"]
categories: ["Source-code"]
author: "nicky_chin"
comments: true
share: true
draft: false
---


#1 源码分析流程
对于阅读源码有兴趣的同学，可以按以下步骤进行：

1. 了解框架架构图
2. 了解各包包含功能点
3. 选择需要功能点入手
4. 了解 **数据流和控制流**
5. 画 **类图 和 时序图**
6. 复盘

# 2 Junit架构详解

### 2.1 包功能概述

通过分析JUnit-3.8.1的源代码文件可以看到，JUnit的源码被分散在6个package中，这个6个package分别为： *junit.awtui* 、 *junit.swingui* 、 *junit.textui* 、 *junit.extensions* 、 *junit.framework* 、 *junit.runner*  具体的文件分布图如下：

![各包情况](https://upload-images.jianshu.io/upload_images/10175660-278a9ef83d38a42d.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

其中 junit.awtui 、 junit.swingui 、 junit.textui 这三个package是有关JUnit运行时的入口程序以及运行结果显示界面的
junit.runner中则包含了支持单元测试运行的一些基础类以及自己的类加载器
junit.framework 包含有编写一般JUnit单元测试类必须组件
junit.extensions则是对framework包在功能上的一些必要功能点的扩展


### 2.2 类图

**junit.framework 类图** 

![famework](https://upload-images.jianshu.io/upload_images/10175660-987c87e79cd5bdf9.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

**junit.extensions 类图** 

![extension](https://upload-images.jianshu.io/upload_images/10175660-90287934613de21e.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

**junit.runner 类图**
![runner](https://upload-images.jianshu.io/upload_images/10175660-250a20e3ae367902.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


# 3 运行流程

**时序图**

![junit时序图.PNG](https://upload-images.jianshu.io/upload_images/10175660-c7138d22bd8bbd28.PNG?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

JUnit的完整生命周期分为3个阶段：_初始化阶段、运行阶段、 结果捕捉阶段_

**测试案例demo**

```
public class CalculatorTest extends TestCase {


    private Calculator calculator = null;

    public static void main(String args[]) {
        TestRunner aTestRunner= new TestRunner();
        try {
            TestResult r= aTestRunner.start(new String[]{"CalculatorTest"});
            if (!r.wasSuccessful())
                System.exit(FAILURE_EXIT);
            System.exit(SUCCESS_EXIT);
        } catch(Exception e) {
            System.err.println(e.getMessage());
            System.exit(EXCEPTION_EXIT);
        }
    }

    @Override
    public void setUp() throws Exception
    {
        System.out.println("set up");
        // 生成成员变量的实例
        calculator = new Calculator();
    }

    public void testAdd() {
        System.out.println("testAdd");
        int result = calculator.add(1, 2);
        System.out.println(result);
        // 判断方法的返回结果
        Assert.assertEquals(3, result);// 第`一个参数是期望值，第二个参数是要验证的值
    }

    public void testSubtract() {
        System.out.println("testSubtract");
        int result = calculator.subtract(1, 2);
        // 判断方法的返回结果
        Assert.assertEquals(-1, result);// 第一个参数是期望值，第二个参数是要验证的值

    }

    public void testMultiply() {
        System.out.println("testMultiply");
        int result = calculator.multiply(2, 3);
        // 判断方法的返回结果
        Assert.assertEquals(5, result);// 第一个参数是期望值，第二个参数是要验证的值

    }

    public void testDivide() {
        System.out.println("testDivide");
        int result = calculator.divide(12, 3);
        // 判断方法的返回结果
        Assert.assertEquals(4, result);// 第一个参数是期望值，第二个参数是要验证的值

    }

}
```

**1.初始化阶段**：
通过分析源码，可以看到JUnit的入口点在 `junit.textui.TestRunner 的 main` 方法，在这个方法中，首先创建一个 _TestRunner_  实例 aTestRunner ，然后 main 函数中主体工作函数为 `TestResult r = aTestRunner.start(args) `。此时 TestRunner 实例存在并开始工作。接下来进入 `start()` 方法中：

```
 public static void main(String args[]) {
        TestRunner aTestRunner= new TestRunner();
        try {
            TestResult r= aTestRunner.start(new String[]{"CalculatorTest"});
            if (!r.wasSuccessful())
                System.exit(FAILURE_EXIT);
            System.exit(SUCCESS_EXIT);
        } catch(Exception e) {
            System.err.println(e.getMessage());
            System.exit(EXCEPTION_EXIT);
        }
    }

	/**
	 * Starts a test run. Analyzes the command line arguments
     * 启动一个测试运行，分析命令参数 并且执行所给的测试组件
	 * and runs the given test suite.
	 */
	public /*protected*/ TestResult start(String args[]) throws Exception {
		String testCase= "";
		boolean wait= false;
		//参数逻辑判断
		for (int i= 0; i < args.length; i++) {
			if (args[i].equals("-wait"))
				wait= true;
			else if (args[i].equals("-c")) 
				testCase= extractClassName(args[++i]);
			else if (args[i].equals("-v"))
				System.err.println("JUnit "+Version.id()+" by Kent Beck and Erich Gamma");
			else
				testCase= args[i];
		}
		
		if (testCase.equals("")) 
			throw new Exception("Usage: TestRunner [-wait] testCaseName, where name is the name of the TestCase class");
		//获取测试组件
		try {
			Test suite= getTest(testCase); //初始化 TestSuite
			return doRun(suite, wait); //运行测试组件
		}
		catch(Exception e) {
			throw new Exception("Could not create and run test suite: "+e);
		}
	}
```

TestResult 用于展示最终结果，首先会进入 `start()` 方法 初始化一个TestSuite对象
_Test suite= getTest(testCase)_;  该测试组件包含了多个 TestCase测试方法用例


**进入getTest方法**

```
/**
	 * Returns the Test corresponding to the given suite. This is
	 * 返回对应的测试组件，这是一个模版方法，子类重写两个方法
	 * a template method, subclasses override runFailed(), clearStatus().
	 */
	public Test getTest(String suiteClassName) {
		if (suiteClassName.length() <= 0) {
			clearStatus();
			return null;
		}
		Class testClass= null;
		try {
		    //加载Class
			testClass= loadSuiteClass(suiteClassName);
		} catch (ClassNotFoundException e) {
			String clazz= e.getMessage();
			if (clazz == null)
				clazz= suiteClassName;
			runFailed("Class not found \""+clazz+"\"");
			return null;
		} catch(Exception e) {
			runFailed("Error: "+e.toString());
			return null;
		}
		Method suiteMethod= null;
		try {//执行测试组件方法
			suiteMethod= testClass.getMethod(SUITE_METHODNAME, new Class[0]);
	 	} catch(Exception e) {
	 		// try to extract a test suite automatically 如果没有对应的方法，则自动创建一个测试组件
			clearStatus(); //清除状态信息
			return new TestSuite(testClass);  //创建testsuite对象 包含需要测试方法集合的Vector
		}
```
`new TestSuite(testClass) `创建对象， 进入构造器主要是一些参数和方法的校验


为每个测试方法创建 TestCase, 并存入 Vector fTests 向量集合中
```
 public TestSuite(final Class theClass) {
		fName= theClass.getName();
		try {//判断是否有公共的带String参数的构造器或者无参构造器，如果没有打印错误信息
			getTestConstructor(theClass); // Avoid generating multiple error messages
		} catch (NoSuchMethodException e) {
			addTest(warning("Class "+theClass.getName()+" has no public constructor TestCase(String name) or TestCase()"));
			return;
		}
		//判断类的修饰符是否是public的，如果不是打印错误信息
		if (!Modifier.isPublic(theClass.getModifiers())) {
			addTest(warning("Class "+theClass.getName()+" is not public"));
			return;
		}

		Class superClass= theClass;
		Vector names= new Vector();
		while (Test.class.isAssignableFrom(superClass)) {//判断当前class是否实现或者继承了Test类
			Method[] methods= superClass.getDeclaredMethods();
			for (int i= 0; i < methods.length; i++) {//遍历继承TestCase方法的类中包含的test方法
				addTestMethod(methods[i], names, theClass);
			}
			superClass= superClass.getSuperclass(); //获取父类并重复上述操作
		}
		if (fTests.size() == 0)
			addTest(warning("No tests found in "+theClass.getName()));
	}
```

关键性代码在 `addTestMethod(methods[i], names, theClass)`

最终添加进入 _fTests_ 集合

```
private void addTestMethod(Method m, Vector names, Class theClass) {
		String name= m.getName();
		if (names.contains(name))
			return;
		if (! isPublicTestMethod(m)) {//判断是否是无参数无返回值方法，是则加入到 names集合里
			if (isTestMethod(m))
				addTest(warning("Test method isn't public: "+m.getName()));
			return;
		}
		names.addElement(name);
		addTest(createTest(theClass, name));//为每个方法增加TestCase用例
	}

	public void addTest(Test test) {
		fTests.addElement(test);
	}
```

**2.测试运行阶段**：

在 TestRunner 中的 `start()` 方法中可以看到开始调用 `doRun(`) 方法开始执行测试

```
	public TestResult doRun(Test suite, boolean wait) {
		TestResult result= createTestResult();
		result.addListener(fPrinter); //增加一个TestRunner的打印监听器
		long startTime= System.currentTimeMillis();
		suite.run(result);
		long endTime= System.currentTimeMillis();
		long runTime= endTime-startTime;
		fPrinter.print(result, runTime);

		pause(wait);
		return result;
	}
```

首先是利用 `createTestResult() `方法生成一个 TestResult 实例，然后将 junit.textui.TestRunner 的监听器 fPrinter 加入到result 的监听器列表中。其中， fPrinter 是 junit.textui.ResultPrinter 类的实例，该类提供了向控制台输出测试结果的一系列功能接口，输出的格式在类中定义。 ResultPrinter 类实现了 TestListener 接口，具体实现了` addError 、 addFailure 、 endTest 和 startTest`  四个重要的方法，这种设计体现了Observer设计模式。而将 ResultPrinter 对象加入到 TestResult 对象的监听器列表中，因此实质上 TestResult 对象可以有多个监听器显示测试结果。 

接下来我们查看run方法，可以看到：

```
public void run(TestResult result) {
		for (Enumeration e= tests(); e.hasMoreElements(); ) {//遍历测试方法
	  		if (result.shouldStop() ) //是否停止继续运行
	  			break;
			Test test= (Test)e.nextElement();
			runTest(test, result);//运行具体测试用例方法TestCase
		}
	}
```

运行具体测试用例方法TestCase,在`runTest(test, result)`方法中

```
protected void run(final TestCase test) {
		startTest(test);
		Protectable p= new Protectable() {
			public void protect() throws Throwable {
				test.runBare();
			}
		};
		runProtected(test, p);//执行test方法

		endTest(test);
	}

	public void runBare() throws Throwable {
		setUp(); //运行setup
		try {
			runTest(); //运行具体测试方法
		}
		finally {
			tearDown();
		}
	}
```
首先它会运行`setUp`方法，在我们的测试demo中会给`private Calculator calculator` 这个成员变量实例化， 然后 `runTest()` 具体跑一个方法 ，该方法首先会通过反射创建一个无参构造器，然后实例化对象，最后获取当前TestCase对象中的测试方法名去获取Method对象，然后`runMethod.invoke(this, new Class[0])`执行该方法，完成测试


**3.测试结果捕捉阶段**：

运行已经完成，日志输出阶段
    
```
public void runProtected(final Test test, Protectable p) {
		try {
			p.protect();
		} 
		catch (AssertionFailedError e) {
			addFailure(test, e); //如果计算结果和assert预期结果不一样，则出现这个错误
		}
		catch (ThreadDeath e) { // don't catch ThreadDeath by accident
			throw e;
		}
		catch (Throwable e) {
			addError(test, e);
		}
	}
```

TestResult对象中有三个观察者对象
>protected Vector fFailures; //观察者 失败信息 TestFailure对象
protected Vector fErrors; //观察者 错误信息 TestFailure 对象
protected Vector fListeners;//观察者 监听器列表 TestListener

如果测试结果与 Assert断言结果不一样，会进入`addFailure(test, e)`方法，其他未知异常会捕获进入`addError(test, e)`记录错误信息，然后存入 _fErrors_ 向量集合中。最后通过 _ResultPrinter_ 答应结果

控制台最终打印结果

```
.set up
testAdd
3
.set up
testDivide
.set up
testSubtract
.set up
testMultiply
F
Time: 1,507.526
There was 1 failure:
1) testMultiply(CalculatorTest)junit.framework.AssertionFailedError: expected:<5> but was:<6>
	at CalculatorTest.testMultiply(CalculatorTest.java:61)
	at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
	at sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)
	at sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)
	at CalculatorTest.main(CalculatorTest.java:23)

FAILURES!!!
Tests run: 4,  Failures: 1,  Errors: 0

```
在执行完`testMultiply`方法后，因为断言的预期结果和实际结果不一致，所以首先会打印一个F表示有错误信息，当所有方法执行完，会执行`fPrinter.print(result, runTime)`方法: **同步答应  耗时 异常信息 断言错误信息 统计结果**

```
	synchronized void print(TestResult result, long runTime) {
	   printHeader(runTime);
	    printErrors(result);
	    printFailures(result);
	    printFooter(result);
	}
```

# 4 总结
在这个源码框架中，你可以看到一些常见的设计模式，比如观察者模式，模版模式，装饰器模式，组合模式等等，通过**类图和时序图** 我们可以清楚明了的了解功能点的用途和具体实现原理，看源码需要懂得取舍，找到关键部分，精髓部分，才能事半功倍
具体junit源码代码及关键注释请看[GitHub](https://github.com/nicky-chen/junit)

# Refence
[分析 JUnit 框架源代码](https://www.ibm.com/developerworks/cn/java/j-lo-junit-src/)
