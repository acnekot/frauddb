# `tel_number_md5` 的算法

结论先放这：**`tel_number_md5 = 小写十六进制的 MD5(号码字符串原样) `**，没有盐，没有归一化。

## 调用链

样本：手机管家 `com.miui.securitycenter` 12.6.1-260422.0.1。

```
ContentObserver / TelephonyCallback
  → MiFraudDetectionService.j(Intent)          // handlePhoneStateChange
      number = intent.getStringExtra("incoming_number")
      → Ba.a.d(number)                          // 原方法名 getMD5String
          → Ba.a.e(bytes)
          → Ba.a.b(digest) → Ba.a.c(bytes, 0, len) → Ba.a.a(byte, buffer)
  → new va.m(numberMd5, start, end, ...)
  → wa.k.f1(va.m)  →  wa.k.g1()  →  insert into fraud_phone
```

`MiFraudDetectionService.j` 里的关键片段（EXTRA_STATE_OFFHOOK 分支）：

```smali
invoke-static {v0}, LBa/a;->d(Ljava/lang/String;)Ljava/lang/String;
move-result-object v8
invoke-static {v8, v6}, LXa/n;->d(Ljava/lang/Object;Ljava/lang/String;)V
# v6 是常量 "getMD5String(...)"，NullPointerTracer 的占位字符串，
# 恰好把被混淆掉的原方法名留了下来
```

同一个 md5 在通话结束时还会被用来更新状态：

```smali
invoke-static {v3}, LBa/a;->d(Ljava/lang/String;)Ljava/lang/String;
invoke-virtual {v0, v3}, Lwa/k;->a2(Ljava/lang/String;)V   # 按 tel_number_md5 更新
```

## 逐层实现

`Ba.a.d(String)`：

```java
public static String d(String s) {
    if (TextUtils.isEmpty(s)) return "";
    return e(s.getBytes());          // 默认字符集，Android 上是 UTF-8
}
```

`Ba.a.e(byte[])`：

```java
public static String e(byte[] data) {
    try {
        MessageDigest md = MessageDigest.getInstance("MD5");
        md.update(data);
        return b(md.digest());
    } catch (Exception ex) {
        Log.e("MD5Util", "getMD5String error: " + ex.getMessage());
        return "";
    }
}
```

`Ba.a.b(byte[]) → Ba.a.c(byte[], int, int)` 逐字节转十六进制，
字符表在 `Ba.a.<clinit>` 里写死：

```
0x30 0x31 0x32 0x33 0x34 0x35 0x36 0x37 0x38 0x39 0x61 0x62 0x63 0x64 0x65 0x66
```

也就是 `0123456789abcdef`，全小写、32 位、无分隔符。

等价的 Java：

```java
MessageDigest md = MessageDigest.getInstance("MD5");
md.update(number.getBytes("UTF-8"));
byte[] d = md.digest();
StringBuilder sb = new StringBuilder();
for (byte x : d) sb.append(String.format("%02x", x));
return sb.toString();
```

等价的 Python：

```python
import hashlib
def tel_number_md5(number: str) -> str:
    return hashlib.md5(number.encode("utf-8")).hexdigest()
```

## 没有做的事

- 没有去空格、去横线、去括号
- 没有补 `+86` 或 `86` 前缀
- 没有去掉国内长途的 `0`
- 没有拼接包名、设备 ID、时间戳之类的盐
- `TextUtils.isEmpty` 命中时直接返回空串，而不是哈希空串

`number` 是 `Intent` 里的 `incoming_number` 原值，中国移动网内号码通常是 11 位纯数字，
国际来电会带 `+` 与国家码，这时参与哈希的就是带前缀的形式。

## 与实测数据一致

库里同一号码的两通电话（10-28 23:43:33 与 23:43:48）哈希相同，不同号码各不相同，
与「只依赖号码本身、无逐条随机盐」的结论吻合。

## 影响

MD5 不加盐、不归一化，意味着这个字段只是「换个写法的号码」：

- 中国大陆 11 位手机号约 9×10⁹ 个，单卡 GPU 级别几小时就能建完彩虹表
- 固定电话号段更短，成本更低
- 同一个号码在任何装了该组件的设备上哈希都一样，可以做跨设备的号码碰撞

换句话说，把它叫作「脱敏」并不成立，它只是提高了肉眼阅读成本。
