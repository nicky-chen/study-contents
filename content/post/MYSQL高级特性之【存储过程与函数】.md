Title: MYSQL高级特性之【存储过程与函数】
Date: 2018-04-27 22:30
Tags: 基础
Category: MySql
Slug: process-fun


# 一、定义

存储程序可以分为存储过程和函数。

## 1.1 存储过程的定义

**存储过程（Stored Procedure）**是一组为了完成特定功能的SQL语句集。存储过程在数据库中经过第一次编译后再次调用不需要再次编译，用户通过指定存储过程的名字并给出参数（如果该存储过程带有参数）来执行它。

## 1.2 函数的定义

存储函数（简称**函数**）在本质上与存储过程没有区别。

只是函数有如：只能返回一个变量的限制，而存储过程可以返回多个。函数是可以嵌入在SQL中使用，可以在select中调用，而存储过程不行。

# 二、创建存储过程和函数

存储过程和函数的创建过程很相似。

## 2.1 创建存储过程
语法
>CREATE PROCEDURE sp_name ([ proc_parameter ]) [ characteristics..] routine_body 

 proc_parameter指定存储过程的参数列表，列表形式如下：

>[IN|OUT|INOUT] param_name type

其中in表示输入参数，out表示输出参数，inout表示既可以输入也可以输出；param_name表示参数名称；type表示参数的类型

该类型可以是MYSQL数据库中的任意类型

有以下取值：
```
characteristic: 
    LANGUAGE SQL 
  | [NOT] DETERMINISTIC 
  | { CONTAINS SQL | NO SQL | READS SQL DATA | MODIFIES SQL DATA } 
  | SQL SECURITY { DEFINER | INVOKER } 
  | COMMENT 'string' 
routine_body: 
    Valid SQL procedure statement or statements
```

**LANGUAGE SQL** ：说明routine_body部分是由SQL语句组成的，当前系统支持的语言为SQL，SQL是LANGUAGE特性的唯一值

**[NOT] DETERMINISTIC** ：指明存储过程执行的结果是否正确。DETERMINISTIC 表示结果是确定的。每次执行存储过程时，相同的输入会得到

相同的输出。

[NOT] DETERMINISTIC 表示结果是不确定的，相同的输入可能得到不同的输出。如果没有指定任意一个值，默认为[NOT] DETERMINISTIC 

**CONTAINS SQL | NO SQL | READS SQL DATA | MODIFIES SQL DATA**：指明子程序使用SQL语句的限制。

CONTAINS SQL表明子程序包含SQL语句，但是不包含读写数据的语句；

NO SQL表明子程序不包含SQL语句；

READS SQL DATA：说明子程序包含读数据的语句；

MODIFIES SQL DATA表明子程序包含写数据的语句。

默认情况下，系统会指定为CONTAINS SQL

**SQL SECURITY { DEFINER | INVOKER }** ：指明谁有权限来执行。DEFINER 表示只有定义者才能执行

INVOKER 表示拥有权限的调用者可以执行。默认情况下，系统指定为DEFINER 

COMMENT 'string' ：注释信息，可以用来描述存储过程或函数

routine_body是SQL代码的内容，可以用BEGIN...END来表示SQL代码的开始和结束


下面的语句创建一个查询order表统计数据的存储过程
```
DROP PROCEDURE IF EXISTS countOrder; 

DELIMITER //
CREATE PROCEDURE countOrder() 
BEGIN
  SELECT count(*) FROM borrow_order;
END//
DELIMITER ;

CALL countOrder(); 
```
这里的逻辑是
1、先判断是否有countOrder() 这个存储过程，有就drop掉
2、创建countOrder() 存储过程
3、执行countOrder() 存储过程

>注意：“DELIMITER //”语句的作用是将MYSQL的结束符设置为//，因为MYSQL默认的语句结束符为分号;，为了避免与存储过程中SQL语句结束符相冲突，需要使用DELIMITER 改变存储过程的结束符，并以“END//”结束存储过程。
存储过程定义完毕之后再使用DELIMITER ;恢复默认结束符。DELIMITER 也可以指定其他符号为结束符！！！！！！！！

---------------------




##2.2 创建函数
创建函数使用CREATE FUNCTION语句：
```
CREATE FUNCTION f_name([func_parameter])
    RETURNS type
    [characteristics...]
   routine_body
```
参数列表可以为空，若不为空，声明形式与存储过程的声明形式一样。characteristics用于指定函数的特性，取值同上，这里不再赘述。
func_parameter为存储函数的参数列表，参数列表如下
>[IN|OUT|INOUT]PARAM_NAMETYPE

RETURNS type表示函数的返回类型；routine_body是函数体，函数体中必须包含一个 RETURN value 语句。

##2.3函数示例
同样的，我们创建一个函数来计算平均工资
```
DELIMITER //
CREATE FUNCTION getAvgAmount()
    RETURNS DECIMAL(8,4)
    RETURN(SELECT AVG(amount) FROM `user`);
//
DELIMITER
```
调用函数
>SELECT getAvgAmount()

#3、复杂的存储过程和函数
##3.1变量的使用

变量可以在子程序中声明并使用，这些变量的作用范围是在BEGIN...END程序中

1、定义变量

在存储过程中定义变量

>DECLARE var_name[,varname]...date_type[DEFAULT VALUE];

var_name为局部变量的名称。DEFAULT VALUE子句给变量提供一个默认值。值除了可以被声明为一个常数外，还可以被指定为一个表达式。

如果没有DEFAULT子句，初始值为NULL

DECLARE MYPARAM INT DEFAULT 100;
 

2、为变量赋值

定义变量之后，为变量赋值可以改变变量的默认值，MYSQL中使用SET语句为变量赋值

>SET var_name=expr[,var_name=expr]...

在存储过程中的SET语句是一般SET语句的扩展版本。

被SET的变量可能是子程序内的变量，或者是全局服务器变量，如系统变量或者用户变量

 

他运行SET a=x,b=y,....

声明3个变量，分别为var1，var2和var3

>DECLARE var1,var2,var3 INT;
SET var1=10,var2=20;
SET var3=var1+var2;

 MYSQL中还可以通过SELECT...INTO为一个或多个变量赋值

>DECLARE NAME CHAR(50);
DECLARE id DECIMAL(8,2);
SELECT id,NAME INTO id ,NAME FROM t3 WHERE id=2;

## 3.2 流程控制的使用

MySQL中的流程控制语句有：`IF`语句、`CASE`语句、`LOOP`语句、`WHILE`语句、`LEAVE`语句、`ITERATE`语句和`REPEAT`语句。

### 3.2.1 IF语句

语法格式如下：

```
IF expr_condition THEN statement_list
    [ELSEIF expr_condition THEN statement_list]...
    [ELSE statement_list]
END IF;
```

### 3.2.2 CASE语句

CASE语句有两种语法格式，第一种如下：

```
CASE expr
    WHEN value1 THEN statement_list
    WHEN value2 THEN statement_list
    ...
    [ELSE statement_list]
END CASE;
```

第二种如下：

```
CASE
    WHEN expr_condition1 THEN statement_list
    WHEN expr_condition2 THEN statement_list
    ...
    [ELSE statement_list]
END CASE;
```

注意：在存储程序里的 CASE 语句 与 直接在SELECT查询里使用的 CASE 函数有略微的不同。在存储程序里的 CASE 语句不能有`ELSE NULL`子句，并且用`END CASE`而不是`END`来终止。

### 3.2.3 LOOP语句

LOOP语句的语法如下：

```
[loop_label:]LOOP
    statement_list
END LOOP [loop_label]
```

loop_label是LOOP语句的标签，该参数可以省略。 LOOP 内的语句一直重复执行直到退出循环，退出循环使用`LEAVE`语句。

### 3.2.4 LEAVE语句

LEAVE语句用来退出任何被标注的流程控制语句，语法如下：

```
LEAVE label;
```

### 3.2.5 ITERATE语句

ITERATE语句将执行顺序转到语句段开头处，ITERATE只可以出现在 LOOP、REPEAT和WHILE语句内。语法如下：

```
ITERATE label;
```

通俗点讲，就是相当于C++里的`continue`。

### 3.2.6 REPEAT语句

REPEAT语句创建一个带条件判断的循环过程：

```
[repeat_label:]REPEAT
    statement_list
UNTIL expr_condition
END REPEAT [repeat_label]
```

### 3.2.7 WHILE语句

WHILE语句也是创建一个带条件判断的循环过程，不同的是在每次执行循环体时先判断：

```
[while_label:]WHILE expr_condition DO
    statement_list
END WHILE [while_label]
```

## 3.3 定义条件和处理程序

特定条件需要特定处理，定义条件是事先定义程序执行过程中遇到的问题，处理程序定义了在遇到这些问题时应当采取的处理方式，这样可以保证存储过程或函数在遇到警告或错误时能继续执行。

### 3.3.1 定义条件

定义条件也是使用`DECLARE`语句：

```
DECLARE condition_name CONDITION FOR SQLSTATE 'sqlstate_value' | mysql_error_code;
```

sqlstate_value 和 mysql_error_code 都可以表示MySQL的错误，例如：`ERROR 1064(42000)`中，sqlstate_value的值是42000，mysql_error_code的值是1064。

这个语句指定需要特殊处理的条件。它将一个名字和指定的错误条件关联起来，这个名字可以用在后面的处理程序中。例如：定义`'ERROR 1064(42000)'`错误名称为`syntax_error`。

```
DECLARE syntax_error CONDITION FOR SQLSTATE '42000';  /*方法一*/
DECLARE syntax_error CONDITION FOR 1064;              /*方法二*/
```

### 3.3.2 定义处理程序

定义处理程序语法如下：

```
DECLARE handler_type HANDLER FOR condition_value sp_statement;
```

*   **handler_type**：表示错误处理方式，只能取以下3个值。 

    *   `CONTINUE`：遇到错误不处理，继续执行；
    *   `EXIT`：遇到错误马上退出；
    *   `UNDO`：遇到错误后撤回之前的操作，MySQL暂不支持。
*   **condition_value**：表示错误类型，可以有以下值： 

    *   `SQLSTATE 'sqlstate_value'`
    *   `mysql_error_code`
    *   condition_name：自定义的条件名称
    *   `SQLWARNING`：匹配所有以01开头的SQLSTATE错误代码
    *   `NOT FOUND`：匹配所有以02开头的SQLSTATE错误代码
    *   `SQLEXCEPTION`：匹配所有没有被SQLWARNING或NOT FOUND捕获的SQLSTATE错误代码
*   **sp_statement**：程序语句段，表示在遇到定义的错误时，需要执行的存储过程或函数。

## 3.4 光标的使用

查询语句可能返回多条记录，如果数据量非常大，需要使用光标（cursor）来**逐条**读取查询结果集中的记录。

### 3.4.1 声明光标

光标必须在打开之前被声明，并且其中用到的变量或条件必须在声明光标之前被声明。MySQL中使用`DECLARE`关键字来声明光标：

```
DECLARE cursor_name CURSOR FOR select_statement;
```

其中的 SELECT 语句返回一个用于创建光标的结果集。

### 3.4.2 打开光标

打开光标的语法如下：

```
OPEN cursor_name;
```

### 3.4.3 使用光标

通过`FETCH`关键字从光标中逐条读取到变量中：

```
FETCH cursor_name INTO var_name[,...];
```

变量var_name必须在声明光标之前就定义好。

### 3.4.4 关闭光标

关闭光标的语法如下：

```
CLOSE cursor_name;
```

**注意：**MySQL中光标只能在存储过程和函数中使用。

### 3.4.5 示例

在`workers`表的基础上，创建一个存储过程，根据输入的城市名，输出该城市所有员工的名字。

```
mysql> DELIMITER //
mysql> CREATE PROCEDURE useCursorDemo(IN city_name VARCHAR(15))
    -> BEGIN
    -> DECLARE m_name VARCHAR(10);
    -> DECLARE m_city VARCHAR(15);
    -> DECLARE m_stop INT DEFAULT 0;
    -> DECLARE mycursor CURSOR FOR SELECT name,city FROM workers WHERE city=city_name;
    -> DECLARE CONTINUE HANDLER FOR NOT FOUND SET m_stop=1;
    -> OPEN mycursor;
    -> FETCH mycursor INTO m_name,m_city;
    -> WHILE m_stop!=1 DO
    -> SELECT m_name,m_city;
    -> FETCH mycursor INTO m_name,m_city;
    -> END WHILE;
    -> CLOSE mycursor;
    -> END//
Query OK, 0 rows affected (0.08 sec)

mysql> DELIMITER ;
```

调用`useCursorDemo`存储过程：

```
mysql> CALL useCursorDemo('Chicago');
+--------+---------+
| m_name | m_city  |
+--------+---------+
| Nina   | Chicago |
+--------+---------+
1 row in set (0.05 sec)

+--------+---------+
| m_name | m_city  |
+--------+---------+
| Tim    | Chicago |
+--------+---------+
1 row in set (0.05 sec)
```

通过这个例子，我们可以了解到如何在存储过程或函数中使用**变量、光标和流程控制。**

## 3.5、修改、删除存储过程和函数

使用`ALTER`语句可以修改存储过程或函数的特性，语法如下：

```
ALTER {PROCEDURE|FUNCTION} sp_name [characteristic]
```

**sp_name**是存储过程或函数的名称，**characteristic**指定存储过程或函数的特性，与创建过程的参数取值是一样的。

使用`DROP`语句删除存储过程或函数，语法如下：

```
DROP {PROCEDURE|FUNCTION} [IF EXISTS] sp_name;
```

#4 存储过程与SQL语句对比
**优势:**

**1、提高性能**
SQL语句在创建过程时进行分析和编译。 存储过程是预编译的，在首次运行一个存储过程时，查询优化器对其进行分析、优化，并给出最终被存在系统表中的存储计划，这样，在执行过程时便可节省此开销。
**2、降低网络开销**
存储过程调用时只需用提供存储过程名和必要的参数信息，从而可降低网络的流量。
**3、便于进行代码移植**
数据库专业人员可以随时对存储过程进行修改，但对应用程序源代码却毫无影响，从而极大的提高了程序的可移植性。
**4、更强的安全性**
1）系统管理员可以对执行的某一个存储过程进行权限限制，避免非授权用户对数据的访问
2）在通过网络调用过程时，只有对执行过程的调用是可见的。 因此，恶意用户无法看到表和数据库对象名称、嵌入自己的 Transact-SQL 语句或搜索关键数据。
3）使用过程参数有助于避免 SQL 注入攻击。 因为参数输入被视作文字值而非可执行代码，所以，攻击者将命令插入过程内的 Transact-SQL 语句并损害安全性将更为困难。
4）可以对过程进行加密，这有助于对源代码进行模糊处理。 

**劣势：**

1、存储过程需要专门的数据库开发人员进行维护
2、设计逻辑变更，修改存储过程没有SQL灵活

为什么在实际应用中，存储过程用到相对较少呢？
在通常的项目研发中，用存储过程却相对较少，这是为什么呢？
分析原因如下：
1）没有特定的数据库开发人员，普通程序员兼职进行数据库操作
2）程序员往往只需操作程序，即可完成数据访问，无需再在数据库上进行开发
3）项目需求变动比较频繁，修改SQL语句比较方便，特别是涉及逻辑变更 

存储过程与SQL语句如何抉择？
基于实际应用的经验，给予如下建议：

1、在一些高效率或者规范性要求比较高的项目，建议采用存储过程
2、对于一般项目建议采用参数化命令方式，是存储过程与SQL语句一种折中的方式
3、对于一些算法要求比较高，涉及多条数据逻辑，建议采用存储过程
