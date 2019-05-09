
---
title: 自定义序列化之Externalizable接口
date: 2017-01-23T11:18:15+08:00
weight: 70
slug: externalizable-interface
tags: ["基础"]
categories: ["java-base"]
author: "nicky_chin"
comments: true
share: true
draft: false
---


**Externalizable简介**
Externalizable是一种优先级要高于 Serializable 的序列化机制接口，
这个接口提供了writeExternal()和readExternal()方法用于指定序列化哪些属性。

**Externalizable接口与Serializable接口区别**
* 1 Serializable序列化时不会调用默认的构造器，而Externalizable序列化时会调用默认构造器
* 2 transient关键字对Externalizable无效

**代码事例**

公共抽象实体类AbstractDO
```
public abstract class AbstractDO implements Externalizable {

    private static final long serialVersionUID = -1679770357930200297L;

    private Long id;

    private Date createTime;

    private Date updateTime;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }

    public Date getUpdateTime() {
        return updateTime;
    }

    public void setUpdateTime(Date updateTime) {
        this.updateTime = updateTime;
    }

    @Override
    public String toString() {
        final StringBuilder sb = new StringBuilder(1 << 5);
        sb.append(", id=").append(id);
        sb.append(", createTime=").append(createTime);
        sb.append(", updateTime=").append(updateTime);
        return sb.toString();
    }
}
```

具体对象SysRole

```
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SysRole extends AbstractDO {

    private static final long serialVersionUID = -7206345155723108987L;

    private String name;

    private String description;

    private Boolean available;

    private transient Integer selected;

    @Override
    public void writeExternal(ObjectOutput out) throws IOException {
        out.writeObject(this.getName());
        out.writeObject(this.getSelected());
    }

    @Override
    public void readExternal(ObjectInput in) throws IOException, ClassNotFoundException {
        this.name = in.readObject().toString();
        this.selected = (int)in.readObject();
       //this.description = in.readObject().toString();

    }

    @Override
    public String toString() {
        final StringBuilder sb = new StringBuilder(1 << 8);
        sb.append("SysRole{");
        sb.append("name=").append(name);
        sb.append(super.toString());
        sb.append(", description=").append(description);
        sb.append(", available=").append(available);
        sb.append(", selected=").append(selected);
        sb.append('}');
        return sb.toString();
    }

}
```
---------------------------------
在 selected字段上加了transient，目的是检查是否能序列化

* 1 _条件1_(只有全参构造器，没有无参构造器)

```
 public static void main(String[] args) throws IOException, ClassNotFoundException {
        File file = new File("D:\\role.obj");
       FileOutputStream fos =  new FileOutputStream(file);
        ObjectOutputStream oos = new ObjectOutputStream(fos);
        SysRole role = new SysRole("", "", true, 1);
        //SysRole role = new SysRole();
        role.setSelected(1);
        role.setName("nana");
        oos.writeObject(role);
        System.out.println("=====================");
        FileInputStream fis = new FileInputStream(file);
        ObjectInputStream ois = new ObjectInputStream(fis);
        SysRole sysRole = (SysRole) ois.readObject();
        System.out.println(sysRole);

    }
```
直接抛异常
```
xception in thread "main" java.io.InvalidClassException: externalizable.SysRole; no valid constructor
```
而加入无参构造器，则结果通过

* 2 _条件2_(序列化和反序列化参数数量不对等)
>加入this.description = in.readObject().toString();

运行上述代码抛异常
```
Exception in thread "main" java.io.OptionalDataException
```
说明序列化和反序列化的参数数量和名称必须对等

* 3 _条件3_(selected字段加入transient )
```
public static void main(String[] args) throws IOException, ClassNotFoundException {
        File file = new File("D:\\role.obj");
       FileOutputStream fos =  new FileOutputStream(file);
        ObjectOutputStream oos = new ObjectOutputStream(fos);
        //SysRole role = new SysRole("", "", true, 1);
        SysRole role = new SysRole();
        role.setSelected(1);
        role.setName("nana");
        oos.writeObject(role);
        System.out.println("=====================");
        FileInputStream fis = new FileInputStream(file);
        ObjectInputStream ois = new ObjectInputStream(fis);
        SysRole sysRole = (SysRole) ois.readObject();
        System.out.println(sysRole);

    }
```
运行结果打印如下：
```
SysRole{name=nana, id=null, createTime=null, updateTime=null, description=null, available=null, selected=1}
```
说明transient对于Externalizable接口的序列化机制无效


