let mode = __dirname.includes('magic')
const {Env} = mode ? require('../magic') : require('./magic')
const $ = new Env('M邀请有礼LOREAL');
$.activityUrl = decodeURIComponent(process.argv.splice(2)?.[0] || process.env.M_LOREAL_INVITE_URL);
if (mode) {
    $.activityUrl = 'https://lorealjdcampaign-rc.isvjcloud.com/interact/index?activityType=10006&templateId=20201228083300yqrhyl01&activityId=1546392212799426561&nodeId=101001005&prd=crm'
}
$.activityUrl = $.match(/(https?:\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|])/, $.activityUrl)
$.domain = $.match(/https?:\/\/([^/]+)/, $.activityUrl)
$.activityId = $.getQueryString($.activityUrl, 'activityId')
$.leaders = [];
//车头数量
let leaderNum = parseInt(process.env.M_LOREAL_INVITE_LEADER_NUM || 5)
// 过滤活动需要的人头数，奖励超过这个值的就不要了，默认88
let needMaxNum = parseInt(process.env.M_LOREAL_INVITE_MAX_NEED_NUM || 88)

$.logic = async function () {
    if (!$.activityId || !$.activityUrl) {
        $.expire = true;
        $.putMsg(`activityId|activityUrl不存在`);
        return
    }
    $.log(`活动地址: ${$.activityUrl}`)
    $.UA = $.ua();

    let token = await $.isvObfuscator();
    if (token.code !== '0') {
        $.putMsg(`获取Token失败`);
        return
    }
    $.Token = token?.token

    let body = {
        "status": "0", "activityId": $.activityId, "tokenPin": $.Token, "source": "01", "shareUserId": ""
    }
    let actInfo = await $.api('apps/interact/api/user-info/login', body);
    if (actInfo.resp_code !== 0) {
        $.expire = true;
        $.putMsg(`登录失败`);
        return
    }
    $.Token = actInfo.data.token

    $.venderId = actInfo.data?.venderId || actInfo.data.shopId;
    $.shopId = actInfo.data.shopId;
    $.shopName = actInfo.data.shopName;

    let openCardStatus = actInfo.data.joinInfo.joinCodeInfo.joinCode === "1001" ? 1 : -1
    if ($.index > leaderNum && openCardStatus === 1) {
        $.log("已经是会员了")
        return;
    }

    let drawPrize = await $.api('apps/interact/api/task/member/prizeList', {})

    if (drawPrize.resp_code !== 0) {
        $.putMsg(`获取活动信息失败`);
        return
    }
    $.content = drawPrize.data.prizeInfo
    let filter = $.content.filter(o => o.prizeType === 1 && o.leftNum > 0);
    if (filter.length === 0) {
        $.putMsg("都是垃圾或已领完")
        this.expire = true;
        return
    }

    let leader = $.leaders.filter(o => o.curCount < o.needCount && o.draw === false)?.[0]
    if ($.index > leaderNum && !leader) {
        $.log("没车头了")
        $.expire = true;
        return;
    }

    $.invitePin = leader?.invitePin || '';

    let getMember = await $.api('apps/interact/api/task/member/getMember', {"shareUserId": $.invitePin || ''})

    if (leader && leader.needCount - leader.curCount > $.cookies.length - $.index) {
        $.putMsg("ck不够了停车")
        $.expire = true;
        return;
    }

    if ($.index <= leaderNum) {
        await $.openCard(9006);
        await $.wait(3000, 5000)
        let getUserId = await $.api('apps/interact/api/task/share/getUserId', {"shareUserId": $.invitePin || ''})
        for (let ele of $.content || []) {
            $.leaders.push({
                index: $.index,
                cookie: $.cookie,
                token: $.Token,
                prizeInfoId: ele.id,
                invitePin: getUserId.data.shareUserId,
                username: $.username,
                needCount: ele.days,
                curCount: getMember.data.shareUser,
                draw: false
            })
        }
    }
    await $.wait(500, 800)

    if (openCardStatus !== 1) {
        let data = await $.openCard(9006);
        // let check = await $.api('/apps/interact/api/join/check', {"status": "0"})
        getMember = await $.api('apps/interact/api/task/member/getMember', {"shareUserId": $.invitePin || ''})
        let myself = await $.api('apps/interact/api/task/bargain/guest/myself', {"shareUserId": $.invitePin || ''})
        if (data?.code === 0 && data?.success && data?.busiCode !== "210") {
            $.log(`助力[${decodeURIComponent($.invitePin)}]成功，助力数++++++`)
            $.leaders.filter(k => k.invitePin === $.invitePin && k.index !== $.index).forEach(o => o.curCount++)
        }
    }

    let ts = $.leaders.filter(k => k.curCount >= k.needCount && k.draw === false) || [];
    for (let t of ts) {
        await $.wait(1500, 1800)
        $.Token = t.token
        getMember = await $.api('apps/interact/api/task/member/getMember', {"shareUserId": ''})
        if (getMember.data.shareUser >= getMember.data.shareNum) {
            let acquire = await $.api('apps/interact/api/prize/receive/acquire', {"prizeInfoId": t.prizeInfoId})
            console.log(acquire)
            if (acquire.resp_code === 0) {
                $.putMsg(`领取成功`, $.getRemarks(t.username) + t.index);
                $.leaders.filter(k => k.index === t.index && k.draw === false)[0].draw = true
            } else {
                if (acquire.resp_msg.includes("未达到领取条件")) {
                    return
                }
                $.leaders.filter(k => k.index === t.index && k.draw === false)[0].draw = true
                $.putMsg(acquire.resp_msg, $.getRemarks(t.username) + t.index);
            }
        }
    }
}

$.after = async function () {
    $.msg.push(`\n${$.shopName}`)
    for (let ele of $.content || []) {
        $.msg.push(`  邀请${ele.days}人 ${ele.prizeName} 共${ele.allNum}/${ele.leftNum}份`)
    }
    $.msg.push(`export M_JOY_INVITE_URL="https://prodev.m.jd.com/mall/active/${$.activityId}/index.html?code=${$.activityCode}"`);
}

$.run().catch(reason => $.log(reason));
