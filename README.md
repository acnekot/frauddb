# 反诈库直查 · fkmiui

读取小米 HyperOS 反诈组件留下的本地数据库 `fraud_detection_data.db`，把里面的记录整理成时间线。

只读，不写回数据库，不上传、不联网（检查更新除外），不收集任何数据。

---

## 背景

- 文件路径：`/data/misc/user/0/securitycenter/fraud_detection_data.db`
- 写入方：`com.miui.securitycenter` 中的 `MiFraudDetectionService`（XSOF 涉诈检测）
- 记录内容：截图时间、屏幕共享/录屏、通话、VoIP 通话、应用安装、涉诈链接、飞行模式、呼叫转移
- 保留策略：写入时清理超窗口的旧记录，截图表通常只保留最近 72 小时

这些记录不会出现在任何系统设置界面里，只能通过数据库查看。

## 功能

- **时间线**：所有表的事件倒序混排，按天分组，可按类型筛选
- **表格**：按表查看原始字段
- **统计**：各表记录数、每天截图数、`sqlite_sequence` 累计写入量
- **媒体配对**：把相册里的截图图片与录屏视频按时间戳配到事件上，显示缩略图
- **通话记录**：用号码 MD5 匹配系统通话记录，还原明文号码与联系人
- **恢复模式**：扫描空闲页与页内空闲块，列出已被删除但仍有残留的记录
- **导出**：时间线 TXT / 全量 JSON / 事件 CSV
- **诊断日志**：记录每次 `su` 调用与布局溢出，便于排查读不到文件的原因
- **MD5 探测**：用系统通话记录试几种号码归一化形式，判断库里 `tel_number_md5` 的计算方式
- **检查更新**：查询 GitHub Release 并在应用内下载安装

## 表结构

针对小米 XSOF 涉诈检测库：

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

字段名从 `sqlite_master` 的建表语句里读，未知表也能在「表格」页展开。

`tel_number_md5` 的算法已经逆出来了，见 [docs/md5-algorithm.md](docs/md5-algorithm.md)：
号码原样取 UTF-8 字节做 MD5，小写十六进制，无盐、无归一化。

## 使用

**安装 APK**

从 [Releases](https://github.com/acnekot/frauddb/releases) 下载 `fkmiui-*.apk` 安装。包名 `com.catsuki.fkmiui`。

**读取数据库**

- 有 root：打开应用后自动尝试五个常见路径，找不到会逐个记录失败原因
- 没有 root：先把文件复制到共享存储，再用「更多 → 选择 db 文件」
- 也可以把数据库拷贝到电脑，用浏览器打开 `web/index.html`，通过文件选择器加载

**权限**

| 权限 | 用途 | 不授予时 |
| --- | --- | --- |
| `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` | 相册截图与录屏配对、缩略图 | 时间线正常显示，没有缩略图 |
| `READ_CALL_LOG` | 用号码 MD5 匹配系统通话记录 | 通话只显示号码摘要 |

权限在「更多 → 权限」里逐项申请，也可以完全不授权，其余功能照常使用。

## 实现说明

- `web/sqlite.js` 用 JavaScript 直接读 SQLite 文件的 b-tree，不依赖系统 sqlite 库。支持页大小 65536、溢出页、UTF-8/UTF-16 文本、freelist 与页内空闲块。因此「恢复模式」可以读取已删除但仍未覆盖的记录。
- `android/` 是一个 WebView 壳，加一层 `@JavascriptInterface` 桥：读写文件、执行 `su`、查询 MediaStore 与 CallLog、下载更新包。
- 界面为单页 HTML，样式和逻辑都在 `web/` 下，改完刷新即可。

## 目录结构

```
web/
  index.html
  app.css              界面样式
  sqlite.js            SQLite 读取与恢复
  ui.js                时间线 / 表格 / 统计 / 导出 / 诊断
android/
  AndroidManifest.xml
  build.sh             不使用 Gradle 的构建脚本
  src/com/catsuki/fkmiui/
    MainActivity.java  壳与 JS 桥
    MediaActivity.java 应用内看图 / 播放
    UpdateProvider.java 把下载的 APK 交给安装器
  res/                 自适应图标
```

## 构建

需要 JDK 17、Android build-tools（`aapt2` `d8` `zipalign` `apksigner`）和 `android.jar`。修改 `android/build.sh` 里的工具链路径后执行：

```bash
export JAVA_HOME=/path/to/jdk-17
bash android/build.sh
```

产物在 `build/frauddb.apk`。首次运行会生成 `android/frauddb.keystore`，该文件不纳入版本库。

## 已知限制

- 没有 root 时读不到 `/data/misc/user/0/securitycenter/`，这是目录权限与 SELinux 限制，非应用问题
- 恢复模式依赖空闲空间未被清零；系统开启 `secure_delete` 时基本捞不到东西
- 只读主库文件，不处理 `-wal` / `-shm`，未 checkpoint 的写入看不到
- 媒体配对依赖文件名里的时间戳，命名不同时回退到 MediaStore 的 `date_added`
- 通话记录的 MD5 与库里算法不一致时，只能按时间匹配

## 免责

本工具用于查看自己设备上的数据，只读、离线。请只对自己有权访问的设备使用。

与小米公司无关联。

## License

MIT
