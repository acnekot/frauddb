# 反诈库直查 · fkmiui

一个只读的 **SQLite 直查工具**，专门用来读小米 HyperOS 反诈组件（XSOF 涉诈检测）留下的
`fraud_detection_data.db`：把截图、录屏、通话、飞行模式、应用安装这些记录解析成一条时间线。

纯前端实现，自带 SQLite 解析器，不依赖任何原生库；安卓端只有一个 WebView 壳。

- 包名：`com.catsuki.fkmiui`
- 数据库原始路径：`/data/misc/user/0/securitycenter/fraud_detection_data.db`
- 写入方：`com.miui.securitycenter` 里的 `MiFraudDetectionService`

> 全程只读。解析、恢复都在内存里完成，不写回数据库，不上传、不联网、不收集任何数据。

---

## 它解决什么问题

HyperOS 的反诈组件会在本地记录敏感行为：什么时候截了图、有没有屏幕共享/录屏、装过哪些应用、
有没有境外或虚拟运营商通话、飞行模式开关、访问过的涉诈链接。这些记录**不会**出现在任何设置界面里，
用户只能靠挖数据库才能看到。

这个工具把这件事做得像个正经 App：选进一个 `db` 文件，直接出可读的时间线。

## 功能

- **时间线**：所有表的事件倒序混排，按天分组，可只筛「截图 / 录屏 / 通话 / 飞行 / 安装 / 链接」
- **表格**：按表查看原始字段，`md5`、`duration`、`app_tag_id` 之类全都不藏
- **统计**：各表记录数、每天截图柱状图、`sqlite_sequence` 累计写入量
- **媒体配对**：读 MediaStore 里的截图图片与录屏视频，按时间戳配到事件上，显示缩略图；录屏还会把库里的时长和视频实际时长对比，点缩略图直接打开原文件
- **恢复模式**：扫页内空闲块和空闲页，把已删除但还留着的旧记录捞回来，标「已删除」显示
- **导出**：时间线 TXT / 全量 JSON / 事件 CSV
- **检查更新**：查 GitHub 最新 Release，一键下载并调起安装

## 支持的库结构

针对小米 XSOF 涉诈检测库，表结构与字段名都对得上：

```
screenshot(_id, screenshot_time)
screen_share(_id, screen_share_package_name, screen_share_start_time,
             screen_share_end_time, is_active, duration)
fraud_phone(_id, call_start_time, call_end_time, is_fraud_call, tel_location,
            tel_number_md5, operator, is_chinese_number, is_virtual_operator,
            is_active, duration)
voip_record(_id, voip_record_package_name, voip_record_start_time,
            voip_record_end_time, is_active, is_fraud_call, duration)
install_app(_id, pkg_name, app_name, source, version_code, md5,
            install_finish_time, app_tag_id, security_tag_id)
fraud_url(_id, access_time, url_type)
airplane_mode(_id, airplane_mode_on, airplane_mode_change_time)
call_forwarding(_id, reason, enabled, timestamp)
```

「表格」页对未知表也照常展开，字段名直接从 `sqlite_master` 的建表语句里解析。

## 技术实现

### 自研 SQLite 读取器（`web/sqlite.js`）

不调用 `sqlite3`、不用 WebAssembly，自己走 b-tree：

- 库头解析：页大小（含 65536 特例）、保留字节、编码（UTF-8 / UTF-16LE / UTF-16BE）
- 表 b-tree 遍历：叶子页 `0x0D` / 内部页 `0x05`，第 1 页要跳过 100 字节库头
- payload 溢出链：按 `maxLocal` / `minLocal` 规则切分，跨页拼接
- 记录解码：变长整数头 + 12 种 serial type，整数做符号扩展，text / blob 分别处理
- 恢复模式：走 freelist（trunk → 叶子页）和每页的 freeblock 链，按「列数 + 时间字段落在毫秒区间」的
  严格校验把残留 cell 归属回具体的表

### 安卓壳（`android/src/com/catsuki/fkmiui/MainActivity.java`）

只有一个 Activity + 一个 `@JavascriptInterface` 桥：

- `autoLoad()` 依次尝试五个常见路径，直读失败就走 `su -c cat`（支持 `su 0 cat` 兜底）
- `pickFile()` 走 SAF，不需要 root
- `screenshots()` 查 MediaStore 拿截图文件名
- `exportText()` 写到 `Android/data/com.catsuki.fkmiui/files/export/`

## 直接用浏览器跑

`web/` 是自包含的，`file://` 打开 `index.html` 也能用：点「更多 → 选择 db 文件」挑一个副本即可，
只是没有相册配对和 root 直读。

## 检查更新

「更多 → 版本 → 检查更新」会拉 `https://api.github.com/repos/acnekot/frauddb/releases/latest`，
取出 `tag_name`、更新说明和 APK 附件，跟本地 `versionName` 按数字段比较（`v1.3 > v1.2.9`）喵。

有新版时显示更新说明，点「下载并安装」会：

1. 下载到 `Android/data/com.catsuki.fkmiui/files/update/`，每 25% 写一条日志
2. 校验拿到的是 `.apk`，通过内置的 `UpdateProvider`（`content://com.catsuki.fkmiui.updates/`）交给系统安装器
3. 没有「安装未知应用」权限时先跳设置页引导

整个过程的 HTTP 状态码、字节数、失败堆栈都会进诊断日志，网络不通也能看到是超时还是 403喵。
不做后台自动检查，也不会不经你确认就下载任何东西喵。

## 诊断日志

root 读不到东西时，先看日志再猜原因喵。

「更多 → 诊断 → 布局诊断」会立刻量一次页面宽度，列出把页面撑宽的元素喵。

「更多 → 诊断 → 跑一次 root 自检」会依次执行 `id`、`getenforce`、`su -v`、`su -c id`、
`su -c ls -ld /data/misc/user/0/securitycenter`、`su -c ls -l <库文件>`、列出已装的 root 管理器、
以及 `ksud -V`，每一步都记录**退出码、耗时、stdout 字节数、预览、stderr**喵。

日志覆盖这些内容：

- 应用启动信息：版本、pid、uid、设备型号、Android 版本、内核、ABI
- 每次 `su` 调用：完整命令行、退出码、耗时、原始输出长度、二进制首字节
- 六个候选路径的 `exists` / `canRead` / `size` / 直读结果
- 权限申请结果、MediaStore 查询数量、文件选择器返回
- WebView 里的 JS 报错（`console.log` / 异常都会进来）
- **布局诊断**：每次渲染后量一次 `scrollWidth` 与 `innerWidth`，一旦有元素超宽，就把它的选择器和左右边界写进日志喵

日志写到 `/data/data/com.catsuki.fkmiui/files/logs/frauddb.log`，超过 512KB 自动轮转成 `.1.log`喵。
在「诊断日志」页可以复制、导出、清空喵。

常见结论对照：

- `exit=1 err=permission denied` → root 管理器没给本应用授权
- `su: not found` / `IOException: ENOENT` → 设备上没有可用的 su
- `exit=TIMEOUT` → 多半在等授权弹窗，或者 late-load 卡在策略加载
- `stdout=0B 无任何输出` 但没报错 → SELinux 拦住了读取

## 构建

需要 JDK 17、Android build-tools（`aapt2` `d8` `zipalign` `apksigner`）和一份 `android.jar`。
`android/build.sh` 里的 `toolchain/` 路径按自己的环境改一下：

```bash
export JAVA_HOME=/path/to/jdk-17
BT=/path/to/build-tools
AJ=/path/to/platforms/android-36/android.jar
bash android/build.sh
```

脚本会依次跑 aapt2 compile / link、javac、d8、打包 dex、zipalign、apksigner，
产物落在 `build/frauddb.apk`。第一次运行会自动生成 `android/frauddb.keystore`（不纳入版本库）。

## 已知限制

- **恢复模式可能挖不到东西**：部分系统开着 `secure_delete`，删除时会清零空闲空间。
  实测小米这套库的空闲区基本被清零，所以「含已删除」经常是 0 条。
- 相册配对依赖 MediaStore 权限，只认 `Screenshot_YYYY-MM-DD-HH-MM-SS-MMM_pkg.ext` 这种命名。
- root 直读走 `su`，没 root 就只能手动选文件。
- 只处理主库文件，不含 `-wal` / `-shm`，未 checkpoint 的写入看不到。
- 只读，不提供任何写入或清理能力。

## 目录结构

```
web/                     前端（可直接用浏览器打开）
  index.html
  app.css                MD3 设计令牌与组件
  sqlite.js              SQLite 解析器 + 恢复模式
  ui.js                  时间线 / 表格 / 统计 / 导出
android/
  AndroidManifest.xml
  build.sh               无 Gradle 的极简构建脚本
  src/com/catsuki/fkmiui/MainActivity.java
  res/                   自适应图标（背景 / 前景 / monochrome）
```

## 免责

这是一个本机取证与自查工具，只读、离线、不采集数据。请只对自己有权访问的设备使用。
本项目与小米公司无关。

## License

MIT
