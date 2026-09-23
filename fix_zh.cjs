const fs = require('fs');

const zhComm = 'src/locales/zh-CN/community.json';
let zhC = JSON.parse(fs.readFileSync(zhComm, 'utf8'));
zhC.feed.writeBtn = "写文章";
zhC.feed.subtitle = "旅行者的记录与灵感";
zhC.feed.searchPlaceholder = "搜索地区，关键词，旅行者...";
zhC.feed.emptySub = "分享您的第一次旅行瞬间与当地见解。";
zhC.feed.writeFirst = "写下第一个故事";
fs.writeFileSync(zhComm, JSON.stringify(zhC, null, 2));

const zhHome = 'src/locales/zh-CN/home.json';
let zhH = JSON.parse(fs.readFileSync(zhHome, 'utf8'));
if(!zhH.desktop) zhH.desktop = {};
zhH.desktop.previewCancel = "取消";
zhH.desktop.previewStart = "去这座城市制定计划";
zhH.desktop.previewLoading = "✨ AI 正在加载城市信息...";
zhH.desktop.terms = "服务条款 (Terms)";
zhH.desktop.privacy = "隐私政策 (Privacy)";
zhH.desktop.contact = "客户服务 (Contact)";
fs.writeFileSync(zhHome, JSON.stringify(zhH, null, 2));

const zhPlan = 'src/locales/zh-CN/plan.json';
let zhP = JSON.parse(fs.readFileSync(zhPlan, 'utf8'));
if(!zhP.desktop) zhP.desktop = {};
zhP.desktop.noPastTripsTitle = "没有过去的旅行";
zhP.desktop.noPastTripsDesc = "还没有记录过去的旅行。";
fs.writeFileSync(zhPlan, JSON.stringify(zhP, null, 2));
