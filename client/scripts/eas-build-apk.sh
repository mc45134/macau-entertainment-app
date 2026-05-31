#!/bin/bash
# EAS Build 脚本 - 构建 Android APK

set -e

echo "==================== EAS Build APK ===================="

# 检查 eas-cli
if ! command -v eas &> /dev/null; then
    echo "安装 eas-cli..."
    npm install -g eas-cli
fi

# 登录 Expo（交互式）
echo "请在浏览器中登录 Expo 账号"
eas login

# 构建 APK
echo "开始构建 Android APK..."
eas build --platform android --profile preview --local

echo "==================== 构建完成 ===================="
echo "APK 文件位于当前目录"
