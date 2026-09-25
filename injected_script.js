/**
 * Steam 客户端内嵌批量售卖核心脚本 (Steam-Client-Injected-Bulk-Seller)
 * 原生注入在 Steam 客户端内部浏览器 (CEF) 运行，天然复用现成登录态与 SessionID。
 */

(function () {
    // 1. 防重复注入检测
    if (window.__STEAM_BULK_SELLER_INJECTED__) {
        console.log('[Steam Bulk Seller] 脚本已注入，跳过重复执行。');
        return;
    }
    window.__STEAM_BULK_SELLER_INJECTED__ = true;

    console.log('[Steam Bulk Seller] 核心脚本加载中...');

    // 2. 注入原生 Steam 深色暗金风格 CSS
    const STYLES = `
    /* 主悬浮/内嵌按钮 */
    .btn-bulk-seller-trigger {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #47bfff 0%, #1a44c2 100%);
        color: #ffffff !important;
        font-family: "Motiva Sans", "Segoe UI", Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        padding: 6px 16px;
        border-radius: 3px;
        border: 1px solid #66c0f4;
        cursor: pointer;
        box-shadow: 0 0 10px rgba(102, 192, 244, 0.4);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
        transition: all 0.2s ease-in-out;
        z-index: 999;
        text-decoration: none !important;
    }
    .btn-bulk-seller-trigger:hover {
        background: linear-gradient(135deg, #66c0f4 0%, #2a6be8 100%);
        box-shadow: 0 0 15px rgba(102, 192, 244, 0.7);
        transform: translateY(-1px);
    }
    .btn-bulk-seller-floating {
        position: fixed;
        bottom: 25px;
        right: 25px;
        z-index: 99999;
        padding: 10px 20px;
        font-size: 14px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6);
    }

    /* Modal 蒙层与容器 */
    #steam-bulk-seller-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(10, 14, 20, 0.85);
        backdrop-filter: blur(5px);
        z-index: 1000000;
        justify-content: center;
        align-items: center;
        font-family: "Motiva Sans", "Segoe UI", Arial, sans-serif;
        color: #c6d4df;
    }
    #steam-bulk-seller-modal.active {
        display: flex;
    }
    .sbs-modal-card {
        width: 920px;
        max-width: 95vw;
        height: 640px;
        max-height: 90vh;
        background: #171a21;
        border: 1px solid #2a475e;
        border-radius: 6px;
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.9);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: sbs-fade-in 0.2s ease-out;
    }
    @keyframes sbs-fade-in {
        from { opacity: 0; transform: scale(0.98); }
        to { opacity: 1; transform: scale(1); }
    }

    /* Modal 头部 */
    .sbs-header {
        padding: 14px 20px;
        background: #1b2838;
        border-bottom: 1px solid #2a475e;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .sbs-title {
        font-size: 16px;
        font-weight: 700;
        color: #ebebeb;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .sbs-title span.badge {
        font-size: 11px;
        background: #2a475e;
        color: #66c0f4;
        padding: 2px 8px;
        border-radius: 10px;
    }
    .sbs-close-btn {
        background: transparent;
        border: none;
        color: #8b929a;
        font-size: 20px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        transition: color 0.15s;
    }
    .sbs-close-btn:hover {
        color: #fff;
    }

    /* Modal 主体左右分栏 */
    .sbs-body {
        display: flex;
        flex: 1;
        overflow: hidden;
    }
    .sbs-sidebar {
        width: 320px;
        border-right: 1px solid #2a475e;
        background: #12141a;
        display: flex;
        flex-direction: column;
    }
    .sbs-sidebar-search {
        padding: 10px 12px;
        border-bottom: 1px solid #222d3d;
        display: flex;
        gap: 6px;
    }
    .sbs-input-search {
        flex: 1;
        background: #1b2838;
        border: 1px solid #2a475e;
        color: #ebebeb;
        padding: 6px 10px;
        border-radius: 3px;
        font-size: 12px;
        outline: none;
    }
    .sbs-input-search:focus {
        border-color: #66c0f4;
    }
    .sbs-btn-refresh {
        background: #2a475e;
        border: none;
        color: #ebebeb;
        padding: 6px 10px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
    }
    .sbs-btn-refresh:hover {
        background: #3b6382;
    }
    .sbs-items-list {
        flex: 1;
        overflow-y: auto;
        padding: 6px;
    }
    .sbs-item-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 4px;
        cursor: pointer;
        border: 1px solid transparent;
        margin-bottom: 4px;
        transition: background 0.15s, border-color 0.15s;
    }
    .sbs-item-card:hover {
        background: #1e2531;
    }
    .sbs-item-card.active {
        background: #20354b;
        border-color: #66c0f4;
    }
    .sbs-item-icon {
        width: 44px;
        height: 44px;
        object-fit: contain;
        background: #1b2838;
        border-radius: 3px;
        border: 1px solid #2a475e;
    }
    .sbs-item-meta {
        flex: 1;
        overflow: hidden;
    }
    .sbs-item-name {
        font-size: 12px;
        color: #ebebeb;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 500;
    }
    .sbs-item-count {
        font-size: 11px;
        color: #66c0f4;
        margin-top: 3px;
    }

    /* 右侧详情与操作面板 */
    .sbs-main-panel {
        flex: 1;
        background: #171a21;
        padding: 20px;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
    }
    .sbs-empty-state {
        margin: auto;
        text-align: center;
        color: #626e7a;
    }

    /* 当前选中物品看板 */
    .sbs-current-header {
        display: flex;
        align-items: center;
        gap: 16px;
        background: #1b2838;
        padding: 12px 16px;
        border-radius: 4px;
        border: 1px solid #2a475e;
    }
    .sbs-current-img {
        width: 60px;
        height: 60px;
        object-fit: contain;
        background: #171a21;
        border: 1px solid #2a475e;
        border-radius: 4px;
    }
    .sbs-current-title {
        font-size: 15px;
        font-weight: bold;
        color: #fff;
    }
    .sbs-current-stock {
        font-size: 12px;
        color: #8f98a0;
        margin-top: 4px;
    }
    .sbs-current-stock b {
        color: #66c0f4;
    }

    /* 行情对比面板 */
    .sbs-depth-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 14px;
    }
    .sbs-depth-box {
        background: #1b2838;
        border: 1px solid #2a475e;
        border-radius: 4px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
    }
    .sbs-depth-label {
        font-size: 11px;
        color: #8b929a;
        margin-bottom: 4px;
    }
    .sbs-depth-price {
        font-size: 18px;
        font-weight: 700;
        font-family: "Motiva Sans", Consolas, monospace;
    }
    .sbs-depth-price.buy {
        color: #88c227;
    }
    .sbs-depth-price.sell {
        color: #e56b6f;
    }

    /* 快捷定价策略栏 */
    .sbs-strategy-bar {
        display: flex;
        gap: 8px;
        margin-top: 14px;
    }
    .sbs-btn-strategy {
        flex: 1;
        padding: 8px 10px;
        background: #2a475e;
        border: 1px solid #3b6382;
        color: #ebebeb;
        font-size: 12px;
        font-weight: 600;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.15s;
        text-align: center;
    }
    .sbs-btn-strategy:hover {
        background: #3b6382;
        border-color: #66c0f4;
    }
    .sbs-btn-strategy.highlight {
        background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
        border-color: #64b5f6;
    }
    .sbs-btn-strategy.highlight:hover {
        background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
    }

    /* 价格与数量输入区 */
    .sbs-form-section {
        background: #1b2838;
        border: 1px solid #2a475e;
        border-radius: 4px;
        padding: 14px;
        margin-top: 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .sbs-form-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .sbs-form-label {
        font-size: 13px;
        color: #c6d4df;
    }
    .sbs-form-inputs {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .sbs-input-num {
        width: 100px;
        background: #171a21;
        border: 1px solid #2a475e;
        color: #fff;
        padding: 6px 8px;
        border-radius: 3px;
        font-size: 13px;
        text-align: right;
    }
    .sbs-input-num:focus {
        border-color: #66c0f4;
        outline: none;
    }
    .sbs-sub-tag {
        font-size: 11px;
        color: #8b929a;
        background: #222d3d;
        padding: 4px 8px;
        border-radius: 3px;
    }
    .sbs-qty-chips {
        display: flex;
        gap: 6px;
    }
    .sbs-chip {
        background: #2a475e;
        border: none;
        color: #ebebeb;
        padding: 4px 10px;
        border-radius: 3px;
        font-size: 11px;
        cursor: pointer;
    }
    .sbs-chip:hover {
        background: #3b6382;
    }

    /* 延时间隔滑动条 */
    .sbs-slider-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .sbs-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 130px;
        height: 6px;
        background: #171a21;
        border: 1px solid #2a475e;
        border-radius: 3px;
        outline: none;
        cursor: pointer;
    }
    .sbs-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background: #66c0f4;
        cursor: pointer;
        box-shadow: 0 0 6px rgba(102, 192, 244, 0.8);
        transition: background 0.15s;
    }
    .sbs-slider::-webkit-slider-thumb:hover {
        background: #47bfff;
    }
    .sbs-slider-val {
        font-size: 12px;
        color: #66c0f4;
        font-family: "Motiva Sans", Consolas, monospace;
        min-width: 165px;
    }

    /* 售卖大按钮 */
    .sbs-btn-action {
        width: 100%;
        margin-top: 14px;
        padding: 12px;
        background: linear-gradient(135deg, #5c7e10 0%, #4b660c 100%);
        border: 1px solid #7ea81b;
        color: #fff;
        font-size: 15px;
        font-weight: 700;
        border-radius: 4px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(92, 126, 16, 0.4);
        transition: all 0.2s;
    }
    .sbs-btn-action:hover:not(:disabled) {
        background: linear-gradient(135deg, #6c9413 0%, #597a0e 100%);
        box-shadow: 0 4px 18px rgba(92, 126, 16, 0.7);
        transform: translateY(-1px);
    }
    .sbs-btn-action:disabled {
        background: #383c42;
        border-color: #4b5058;
        color: #7b8089;
        cursor: not-allowed;
        box-shadow: none;
        transform: none;
    }

    /* 实时进度与日志 */
    .sbs-progress-wrap {
        margin-top: 14px;
        display: none;
        flex-direction: column;
        gap: 6px;
    }
    .sbs-progress-bar-bg {
        width: 100%;
        height: 10px;
        background: #101216;
        border-radius: 5px;
        overflow: hidden;
        border: 1px solid #2a475e;
    }
    .sbs-progress-bar-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #66c0f4, #5c7e10);
        transition: width 0.3s ease;
    }
    .sbs-progress-text {
        font-size: 12px;
        color: #8b929a;
        display: flex;
        justify-content: space-between;
    }
    .sbs-console-log {
        height: 90px;
        background: #101216;
        border: 1px solid #222d3d;
        border-radius: 3px;
        padding: 6px 10px;
        font-family: Consolas, monospace;
        font-size: 11px;
        color: #8b929a;
        overflow-y: auto;
        white-space: pre-wrap;
        margin-top: 6px;
    }

    /* 成功完成醒目弹层 */
    .sbs-finish-alert {
        display: none;
        margin-top: 14px;
        padding: 12px 16px;
        background: rgba(92, 126, 16, 0.25);
        border: 1px solid #88c227;
        border-radius: 4px;
        color: #d2efa6;
        font-size: 12px;
        line-height: 1.5;
    }
    .sbs-finish-alert b {
        color: #fff;
        font-size: 13px;
    }
    `;

    // 注入样式
    const styleEl = document.createElement('style');
    styleEl.id = 'steam-bulk-seller-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);

    // 3. Steam 官方精确费率公式与避坑抢排头算法
    const PricingEngine = {
        /**
         * Steam 官方手续费计算公式（严格到分/cents）
         * 基础规则：Steam 手续费 5% (最小 1 分)，发行商手续费 10% (最小 1 分)
         * @param {number} sellerReceives 卖家实收分值
         * @returns {number} 买家支付总额（分值）
         */
        calculateBuyerPays: function (sellerReceives) {
            if (sellerReceives <= 0) return 0;
            const steamFee = Math.max(Math.floor(sellerReceives * 0.05), 1);
            const publisherFee = Math.max(Math.floor(sellerReceives * 0.10), 1);
            return sellerReceives + steamFee + publisherFee;
        },

        /**
         * 核心避坑反推算法：二分求解在给定的买家支付总价约束下，卖家所能得到的最大合法实收分值。
         * 完美解决直接相除取整导致价格被 Steam 强制改写或失真的顽疾！
         * @param {number} targetBuyerPays 目标买家支付总额（分）
         * @returns {number} 最佳卖家实收分值
         */
        getOptimalSellerReceives: function (targetBuyerPays) {
            if (targetBuyerPays <= 2) return 1;
            let low = 1;
            let high = targetBuyerPays;
            let best = 1;

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const computedBuyerPays = this.calculateBuyerPays(mid);

                if (computedBuyerPays <= targetBuyerPays) {
                    best = mid;
                    low = mid + 1; // 尝试探寻是否有更高的合法实收
                } else {
                    high = mid - 1;
                }
            }
            return best;
        },

        /**
         * 策略 1：秒出策略（以最高求购价成交）
         * @param {number} highestBuyOrder 买家最高求购价（分）
         */
        calcInstantSell: function (highestBuyOrder) {
            if (!highestBuyOrder || highestBuyOrder <= 0) return { sellerReceives: 0, buyerPays: 0 };
            const seller = this.getOptimalSellerReceives(highestBuyOrder);
            return {
                sellerReceives: seller,
                buyerPays: this.calculateBuyerPays(seller)
            };
        },

        /**
         * 策略 2：抢首位避坑策略（买家总价精准比最低在售价便宜 1 分钱）
         * @param {number} lowestSellOrder 最低在售价（分）
         */
        calcUndercutFirst: function (lowestSellOrder) {
            if (!lowestSellOrder || lowestSellOrder <= 3) {
                return { sellerReceives: 1, buyerPays: 3 };
            }
            const targetBuyerPays = Math.max(lowestSellOrder - 1, 3);
            const seller = this.getOptimalSellerReceives(targetBuyerPays);
            return {
                sellerReceives: seller,
                buyerPays: this.calculateBuyerPays(seller)
            };
        },

        /**
         * 策略 3：跟随最低在售价（排在最低在售队列末尾）
         * @param {number} lowestSellOrder 最低在售价（分）
         */
        calcMatchLowest: function (lowestSellOrder) {
            if (!lowestSellOrder || lowestSellOrder <= 0) return { sellerReceives: 0, buyerPays: 0 };
            const seller = this.getOptimalSellerReceives(lowestSellOrder);
            return {
                sellerReceives: seller,
                buyerPays: this.calculateBuyerPays(seller)
            };
        }
    };

    // 4. 模态窗口 HTML 结构构建
    function createModalDom() {
        const modal = document.createElement('div');
        modal.id = 'steam-bulk-seller-modal';
        modal.innerHTML = `
        <div class="sbs-modal-card">
            <div class="sbs-header">
                <div class="sbs-title">
                    ⚡ Steam 客户端内嵌批量售卖工具
                    <span class="badge">开源版 v1.0.0</span>
                </div>
                <button class="sbs-close-btn" id="sbs-btn-close" title="关闭 (ESC)">✕</button>
            </div>
            <div class="sbs-body">
                <!-- 左侧：聚合资产列表 -->
                <div class="sbs-sidebar">
                    <div class="sbs-sidebar-search">
                        <input type="text" class="sbs-input-search" id="sbs-search-box" placeholder="搜索库存物品 (中/英文)..." />
                        <button class="sbs-btn-refresh" id="sbs-btn-reload-inv" title="重新扫描当前库存">🔄</button>
                    </div>
                    <div class="sbs-items-list" id="sbs-items-container">
                        <!-- 动态渲染物品项 -->
                    </div>
                </div>

                <!-- 右侧：详情与售卖控制面板 -->
                <div class="sbs-main-panel" id="sbs-main-panel">
                    <div class="sbs-empty-state" id="sbs-empty-state">
                        <p style="font-size: 15px; margin-bottom: 6px;">👈 请在左侧列表中点击选择要售卖的物品</p>
                        <p style="font-size: 12px; color: #55606d;">本插件已自动帮您合并同类物品资产</p>
                    </div>

                    <div id="sbs-active-panel" style="display: none; flex-direction: column;">
                        <!-- 当前选中物品头部 -->
                        <div class="sbs-current-header">
                            <img src="" id="sbs-item-preview" class="sbs-current-img" />
                            <div>
                                <div class="sbs-current-title" id="sbs-item-title">-</div>
                                <div class="sbs-current-stock">
                                    库存总计：<b id="sbs-item-stock-count">0</b> 件 | 当前分类 AppID: <span id="sbs-item-appid">-</span>
                                </div>
                            </div>
                        </div>

                        <!-- 深度买卖行情 -->
                        <div class="sbs-depth-grid">
                            <div class="sbs-depth-box">
                                <span class="sbs-depth-label">🟢 最高求购价 (秒出)</span>
                                <span class="sbs-depth-price buy" id="sbs-depth-buy-val">加载中...</span>
                            </div>
                            <div class="sbs-depth-box">
                                <span class="sbs-depth-label">🔴 最低在售价 (排队)</span>
                                <span class="sbs-depth-price sell" id="sbs-depth-sell-val">加载中...</span>
                            </div>
                        </div>

                        <!-- 快捷定价策略 -->
                        <div class="sbs-strategy-bar">
                            <button class="sbs-btn-strategy" id="sbs-strat-instant">⚡ 以求购价秒出</button>
                            <button class="sbs-btn-strategy highlight" id="sbs-strat-undercut">⚡ 抢首位 (避坑算法)</button>
                            <button class="sbs-btn-strategy" id="sbs-strat-match">⏳ 跟随最低在售</button>
                        </div>

                        <!-- 定价与数量表单 -->
                        <div class="sbs-form-section">
                            <div class="sbs-form-row">
                                <span class="sbs-form-label">💰 卖家实收：</span>
                                <div class="sbs-form-inputs">
                                    <span class="sbs-sub-tag">¥</span>
                                    <input type="number" step="0.01" min="0.01" class="sbs-input-num" id="sbs-input-seller-price" value="0.00" />
                                </div>
                            </div>
                            <div class="sbs-form-row">
                                <span class="sbs-form-label">🛒 买家最终支付总价：</span>
                                <div class="sbs-form-inputs">
                                    <span class="sbs-sub-tag">¥</span>
                                    <input type="number" step="0.01" min="0.03" class="sbs-input-num" id="sbs-input-buyer-price" value="0.00" />
                                </div>
                            </div>
                            <div class="sbs-form-row" style="margin-top: 4px; padding-top: 10px; border-top: 1px dashed #222d3d;">
                                <span class="sbs-form-label">📦 上架售卖数量：</span>
                                <div class="sbs-form-inputs">
                                    <input type="number" min="1" class="sbs-input-num" id="sbs-input-sell-qty" value="1" />
                                    <div class="sbs-qty-chips">
                                        <button class="sbs-chip" id="sbs-chip-half">半数</button>
                                        <button class="sbs-chip" id="sbs-chip-all">全部</button>
                                    </div>
                                </div>
                            </div>
                            <div class="sbs-form-row" style="margin-top: 4px; padding-top: 10px; border-top: 1px dashed #222d3d;">
                                <span class="sbs-form-label">⏱️ 挂单延时间隔：</span>
                                <div class="sbs-slider-wrap">
                                    <input type="range" min="0.5" max="2.0" step="0.1" value="1.0" class="sbs-slider" id="sbs-input-delay-slider" />
                                    <span class="sbs-slider-val" id="sbs-slider-delay-val">当前: 1.0 秒 (+0.1s 随机)</span>
                                </div>
                            </div>
                        </div>

                        <!-- 启动售卖大按钮 -->
                        <button class="sbs-btn-action" id="sbs-btn-start-sell">🚀 开始批量上架</button>

                        <!-- 进度条与实时控制台 -->
                        <div class="sbs-progress-wrap" id="sbs-progress-wrap">
                            <div class="sbs-progress-text">
                                <span id="sbs-progress-status">准备就绪</span>
                                <span id="sbs-progress-percent">0%</span>
                            </div>
                            <div class="sbs-progress-bar-bg">
                                <div class="sbs-progress-bar-fill" id="sbs-progress-bar-fill"></div>
                            </div>
                            <div class="sbs-console-log" id="sbs-console-log"></div>
                        </div>

                        <!-- 手机 2FA 提示框 -->
                        <div class="sbs-finish-alert" id="sbs-finish-alert">
                            <b>🎉 挂单请求已全部发送完毕！</b><br>
                            若涉及需人工确认的物品，请前往<b>手机 Steam 官方 App</b>的【确认】页面查看并批准；小额物品通常已直接上架成功。
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.appendChild(modal);

        // 绑定关闭事件
        document.getElementById('sbs-btn-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeModal();
            }
        });
    }

    function openModal() {
        const modal = document.getElementById('steam-bulk-seller-modal');
        if (modal) {
            modal.classList.add('active');
            refreshInventoryList();
        }
    }

    function closeModal() {
        const modal = document.getElementById('steam-bulk-seller-modal');
        if (modal) modal.classList.remove('active');
    }

    // 5. 库存数据提取与聚合逻辑
    let currentAggregatedItems = [];
    let selectedItem = null;
    let depthCache = {
        highestBuyCents: 0,
        lowestSellCents: 0
    };

    function extractCurrentInventory() {
        const result = [];
        const itemsMap = new Map();

        // 优先读取活跃库存对象
        const activeInv = window.g_ActiveInventory;
        if (!activeInv) {
            console.warn('[Steam Bulk Seller] 未找到 g_ActiveInventory 全局对象');
            return [];
        }

        const assets = activeInv.m_rgAssets || activeInv.m_rgItemData || {};
        const descriptions = activeInv.m_rgDescriptions || {};

        for (const assetId in assets) {
            const asset = assets[assetId];
            if (!asset) continue;

            const classid = asset.classid;
            const instanceid = asset.instanceid || '0';
            const descKey = `${classid}_${instanceid}`;
            const desc = descriptions[descKey] || asset.description || {};

            // 过滤不可交易或不可出售的物品
            if (desc.marketable !== 1 && desc.marketable !== true) {
                continue;
            }

            const hashName = desc.market_hash_name || desc.name || 'Unknown Item';
            const appid = asset.appid || activeInv.m_appid || 730;
            const contextid = asset.contextid || activeInv.m_contextid || 2;

            if (!itemsMap.has(hashName)) {
                itemsMap.set(hashName, {
                    market_hash_name: hashName,
                    market_name: desc.market_name || desc.name || hashName,
                    icon_url: desc.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}/96fx96f` : '',
                    appid: appid,
                    contextid: contextid,
                    classid: classid,
                    assetIds: [asset.assetid || assetId]
                });
            } else {
                itemsMap.get(hashName).assetIds.push(asset.assetid || assetId);
            }
        }

        itemsMap.forEach((val) => {
            val.count = val.assetIds.length;
            result.push(val);
        });

        // 默认按拥有数量降序排序
        result.sort((a, b) => b.count - a.count);
        return result;
    }

    function refreshInventoryList() {
        currentAggregatedItems = extractCurrentInventory();
        renderItemList(currentAggregatedItems);
    }

    function renderItemList(items) {
        const container = document.getElementById('sbs-items-container');
        if (!container) return;
        container.innerHTML = '';

        if (items.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #55606d; font-size: 12px;">当前库存分类下无任何可售卖物品。请在 Steam 客户端内切换至 CS2 / Dota2 等库存后重试。</div>';
            return;
        }

        items.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'sbs-item-card';
            if (selectedItem && selectedItem.market_hash_name === item.market_hash_name) {
                card.classList.add('active');
            }
            card.innerHTML = `
                <img src="${item.icon_url || ''}" class="sbs-item-icon" />
                <div class="sbs-item-meta">
                    <div class="sbs-item-name" title="${item.market_name}">${item.market_name}</div>
                    <div class="sbs-item-count">拥有: <b>${item.count}</b> 件</div>
                </div>
            `;
            card.addEventListener('click', () => selectItem(item, card));
            container.appendChild(card);
        });
    }

    // 6. 货币与金额文本稳健解析工具（支持国内外多种货币符号与千分符）
    function parsePriceStringToCents(priceStr) {
        if (!priceStr || typeof priceStr !== 'string') return 0;
        let cleaned = priceStr.replace(/[^\d.,]/g, '').trim();
        if (!cleaned) return 0;

        // 处理逗号作为小数点的欧洲格式 (如 12,50 或 1.250,50)
        if (cleaned.includes(',') && !cleaned.includes('.')) {
            cleaned = cleaned.replace(',', '.');
        } else if (cleaned.includes(',') && cleaned.includes('.')) {
            if (cleaned.indexOf(',') < cleaned.indexOf('.')) {
                // 逗号为千分符: 1,250.50
                cleaned = cleaned.replace(/,/g, '');
            } else {
                // 点为千分符: 1.250,50
                cleaned = cleaned.replace(/\./g, '').replace(',', '.');
            }
        }
        const val = parseFloat(cleaned);
        return isNaN(val) ? 0 : Math.round(val * 100);
    }

    // 选中物品并获取深度双向行情 (带多重容错与强力兜底)
    async function selectItem(item, cardElement) {
        selectedItem = item;
        // 更新高亮样式
        document.querySelectorAll('.sbs-item-card').forEach(el => el.classList.remove('active'));
        if (cardElement) cardElement.classList.add('active');

        // 显示操作区域
        document.getElementById('sbs-empty-state').style.display = 'none';
        const activePanel = document.getElementById('sbs-active-panel');
        activePanel.style.display = 'flex';

        // 渲染基础信息
        document.getElementById('sbs-item-preview').src = item.icon_url || '';
        document.getElementById('sbs-item-title').textContent = item.market_name;
        document.getElementById('sbs-item-stock-count').textContent = item.count;
        document.getElementById('sbs-item-appid').textContent = item.appid;
        document.getElementById('sbs-input-sell-qty').max = item.count;
        document.getElementById('sbs-input-sell-qty').value = item.count;

        // 重置状态
        document.getElementById('sbs-depth-buy-val').textContent = '正在获取...';
        document.getElementById('sbs-depth-sell-val').textContent = '正在获取...';
        document.getElementById('sbs-finish-alert').style.display = 'none';
        document.getElementById('sbs-progress-wrap').style.display = 'none';
        document.getElementById('sbs-console-log').textContent = '';

        // 执行多重容错查价流程
        await fetchMarketPricing(item);
    }

    // 多重兼容提取 item_nameid (兼容 Steam 现代 SSR / React / 旧版函数)
    async function getItemNameId(appid, marketHashName) {
        const cacheKey = `sbs_nameid_${appid}_${marketHashName}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) return cached;

        try {
            const listingUrl = `/market/listings/${appid}/${encodeURIComponent(marketHashName)}`;
            const resp = await fetch(listingUrl);
            if (!resp.ok) return null;
            const html = await resp.text();

            // 多重匹配模式：现代 Steam SSR / React 属性 / JSON / 旧版函数
            const patterns = [
                /item_nameid[\s"':=]+(\d+)/i,
                /"nameid"\s*:\s*"?(\d+)"?/i,
                /"item_nameid"\s*:\s*"?(\d+)"?/i,
                /Market_LoadOrderSpread\(\s*(\d+)\s*\)/,
                /data-nameid=["'](\d+)["']/i,
                /Market_LoadOrderSpread.*?(\d{5,})/s,
                /loaderData.*?nameid.*?(\d+)/s
            ];

            for (const pat of patterns) {
                const match = html.match(pat);
                if (match && match[1]) {
                    const nameId = match[1];
                    sessionStorage.setItem(cacheKey, nameId);
                    return nameId;
                }
            }
        } catch (e) {
            console.warn('[Steam Bulk Seller] 抓取 item_nameid 异常:', e);
        }
        return null;
    }

    // 官方 priceoverview 强力降级兜底接口
    async function fetchPriceOverviewFallback(appid, marketHashName) {
        try {
            const url = `/market/priceoverview/?appid=${appid}&currency=23&market_hash_name=${encodeURIComponent(marketHashName)}`;
            const resp = await fetch(url);
            if (!resp.ok) return null;
            const data = await resp.json();
            if (data && data.success) {
                const lowestPriceStr = data.lowest_price || data.median_price;
                const lowestSellCents = parsePriceStringToCents(lowestPriceStr);
                return {
                    highestBuyCents: 0,
                    lowestSellCents: lowestSellCents
                };
            }
        } catch (e) {
            console.warn('[Steam Bulk Seller] priceoverview 兜底获取异常:', e);
        }
        return null;
    }

    // 核心综合查价流程 (5分钟 sessionStorage 缓存 + 深度订单簿 + 官方接口双保险)
    async function fetchMarketPricing(item) {
        const cacheKey = `sbs_price_v3_${item.appid}_${item.market_hash_name}`;
        const cachedStr = sessionStorage.getItem(cacheKey);

        // 1. 检查 5 分钟有效缓存
        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr);
                if (Date.now() - cached.timestamp < 300000) {
                    console.log('[Steam Bulk Seller] 命中 5 分钟价格缓存:', item.market_hash_name);
                    applyPriceData(cached.highestBuyCents, cached.lowestSellCents);
                    return;
                }
            } catch (e) {}
        }

        let highestBuyCents = 0;
        let lowestSellCents = 0;
        let fetchSuccess = false;

        // 2. 深度订单簿（求购/在售）获取尝试
        try {
            const nameId = await getItemNameId(item.appid, item.market_hash_name);
            if (nameId) {
                const histUrl = `/market/itemordershistogram?country=CN&language=schinese&currency=23&item_nameid=${nameId}&two_factor=0&norender=1`;
                const resp = await fetch(histUrl);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data) {
                        if (data.highest_buy_order) {
                            highestBuyCents = parseInt(data.highest_buy_order, 10);
                        } else if (data.buy_order_graph && data.buy_order_graph.length > 0) {
                            highestBuyCents = Math.round(data.buy_order_graph[0][0] * 100);
                        }

                        if (data.lowest_sell_order) {
                            lowestSellCents = parseInt(data.lowest_sell_order, 10);
                        } else if (data.sell_order_graph && data.sell_order_graph.length > 0) {
                            lowestSellCents = Math.round(data.sell_order_graph[0][0] * 100);
                        }

                        if (highestBuyCents > 0 || lowestSellCents > 0) {
                            fetchSuccess = true;
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[Steam Bulk Seller] 深度订单簿接口获取异常，准备降级:', err);
        }

        // 3. 官方 priceoverview 兜底保障
        if (!fetchSuccess || lowestSellCents === 0) {
            console.log('[Steam Bulk Seller] 启动官方 priceoverview 接口兜底获取价格...');
            const fallback = await fetchPriceOverviewFallback(item.appid, item.market_hash_name);
            if (fallback && fallback.lowestSellCents > 0) {
                lowestSellCents = fallback.lowestSellCents;
                fetchSuccess = true;
            }
        }

        // 4. 处理最终结果与 5 分钟缓存
        if (fetchSuccess) {
            sessionStorage.setItem(cacheKey, JSON.stringify({
                highestBuyCents: highestBuyCents,
                lowestSellCents: lowestSellCents,
                timestamp: Date.now()
            }));
            applyPriceData(highestBuyCents, lowestSellCents);
        } else {
            depthCache.highestBuyCents = 0;
            depthCache.lowestSellCents = 0;
            document.getElementById('sbs-depth-buy-val').textContent = '暂无求购';
            document.getElementById('sbs-depth-sell-val').textContent = '获取失败';
        }
    }

    function applyPriceData(highestBuyCents, lowestSellCents) {
        depthCache.highestBuyCents = highestBuyCents;
        depthCache.lowestSellCents = lowestSellCents;

        document.getElementById('sbs-depth-buy-val').textContent = highestBuyCents > 0 ? `¥ ${(highestBuyCents / 100).toFixed(2)}` : '暂无求购';
        document.getElementById('sbs-depth-sell-val').textContent = lowestSellCents > 0 ? `¥ ${(lowestSellCents / 100).toFixed(2)}` : '暂无在售';

        // 智能应用定价策略
        if (lowestSellCents > 0) {
            applyPricingStrategy('undercut');
        } else if (highestBuyCents > 0) {
            applyPricingStrategy('instant');
        }
    }

    function applyPricingStrategy(strategyType) {
        let result = { sellerReceives: 0, buyerPays: 0 };
        if (strategyType === 'instant') {
            result = PricingEngine.calcInstantSell(depthCache.highestBuyCents);
        } else if (strategyType === 'undercut') {
            result = PricingEngine.calcUndercutFirst(depthCache.lowestSellCents);
        } else if (strategyType === 'match') {
            result = PricingEngine.calcMatchLowest(depthCache.lowestSellCents);
        }

        if (result.sellerReceives > 0) {
            document.getElementById('sbs-input-seller-price').value = (result.sellerReceives / 100).toFixed(2);
            document.getElementById('sbs-input-buyer-price').value = (result.buyerPays / 100).toFixed(2);
        }
    }

    // 7. 批量挂单与防 429 单线程队列
    let isSellingInProgress = false;

    async function startBatchSelling() {
        if (isSellingInProgress || !selectedItem) return;

        const sellerPriceVal = parseFloat(document.getElementById('sbs-input-seller-price').value);
        if (isNaN(sellerPriceVal) || sellerPriceVal <= 0) {
            alert('请输入合法的卖家实收价格！');
            return;
        }
        const sellerReceivesCents = Math.round(sellerPriceVal * 100);

        let sellQty = parseInt(document.getElementById('sbs-input-sell-qty').value, 10);
        if (isNaN(sellQty) || sellQty <= 0) {
            alert('请输入合法的售卖数量！');
            return;
        }
        sellQty = Math.min(sellQty, selectedItem.assetIds.length);

        if (!confirm(`确定要以【实收 ¥${(sellerReceivesCents / 100).toFixed(2)}】的价格，批量上架 ${sellQty} 件 [${selectedItem.market_name}] 吗？`)) {
            return;
        }

        isSellingInProgress = true;
        const btnAction = document.getElementById('sbs-btn-start-sell');
        btnAction.disabled = true;
        btnAction.textContent = '⏳ 正在批量上架中...';

        const progressWrap = document.getElementById('sbs-progress-wrap');
        const progressBar = document.getElementById('sbs-progress-bar-fill');
        const progressStatus = document.getElementById('sbs-progress-status');
        const progressPercent = document.getElementById('sbs-progress-percent');
        const consoleLog = document.getElementById('sbs-console-log');
        const finishAlert = document.getElementById('sbs-finish-alert');

        progressWrap.style.display = 'flex';
        finishAlert.style.display = 'none';
        consoleLog.textContent = `[${new Date().toLocaleTimeString()}] 开始执行批量售卖任务，总计: ${sellQty} 件...\n`;

        const sessionID = window.g_sessionID;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < sellQty; i++) {
            const assetId = selectedItem.assetIds[i];
            const currentIdx = i + 1;
            const pct = Math.round((currentIdx / sellQty) * 100);

            progressStatus.textContent = `[${currentIdx} / ${sellQty}] 正在提交挂牌...`;
            progressPercent.textContent = `${pct}%`;
            progressBar.style.width = `${pct}%`;

            const formData = new URLSearchParams();
            formData.append('sessionid', sessionID);
            formData.append('appid', selectedItem.appid.toString());
            formData.append('contextid', selectedItem.contextid.toString());
            formData.append('assetid', assetId.toString());
            formData.append('amount', '1');
            formData.append('price', sellerReceivesCents.toString());

            let isSuccess = false;
            let retryAttempts = 0;

            while (!isSuccess && retryAttempts < 3) {
                try {
                    const resp = await fetch('/market/sellitem/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'Accept': 'application/json'
                        },
                        body: formData
                    });

                    if (resp.status === 429) {
                        consoleLog.textContent += `[!] 触发 Steam 429 限频，自动等待 10 秒后重试...\n`;
                        consoleLog.scrollTop = consoleLog.scrollHeight;
                        await new Promise(r => setTimeout(r, 10000));
                        retryAttempts++;
                        continue;
                    }

                    const resJson = await resp.json();
                    if (resJson && (resJson.success || resJson.requires_confirmation)) {
                        isSuccess = true;
                        successCount++;
                        consoleLog.textContent += `[√] [${currentIdx}/${sellQty}] 挂单已提交 (资产: ${assetId}) 实收: ¥${(sellerReceivesCents / 100).toFixed(2)}\n`;
                    } else {
                        failCount++;
                        const msg = (resJson && resJson.message) ? resJson.message : '未知原因';
                        consoleLog.textContent += `[-] [${currentIdx}/${sellQty}] 提交失败 (资产: ${assetId}): ${msg}\n`;
                        break;
                    }
                } catch (err) {
                    retryAttempts++;
                    consoleLog.textContent += `[!] 网络异常重试第 ${retryAttempts} 次: ${err.message}\n`;
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
            consoleLog.scrollTop = consoleLog.scrollHeight;

            // 挂单延时控制：基准延时 (默认 1.0 秒，可调滑块) + 拟人化随机抖动 (0~100ms)
            if (i < sellQty - 1) {
                const delaySliderEl = document.getElementById('sbs-input-delay-slider');
                const baseDelaySec = delaySliderEl ? (parseFloat(delaySliderEl.value) || 1.0) : 1.0;
                const jitterMs = Math.floor(Math.random() * 100); // 0~100ms 动态随机浮动
                const totalDelayMs = Math.round(baseDelaySec * 1000) + jitterMs;
                await new Promise(resolve => setTimeout(resolve, totalDelayMs));
            }
        }

        // 完成提示
        btnAction.disabled = false;
        btnAction.textContent = '🚀 开始批量上架';
        progressStatus.textContent = `任务完成！成功: ${successCount} 件，失败: ${failCount} 件`;
        finishAlert.style.display = 'block';
        isSellingInProgress = false;

        // 重新同步并刷新本物品的剩余资产
        refreshInventoryList();
    }

    // 8. 挂载入口按钮到 Steam 原生界面
    function mountUiButtons() {
        createModalDom();

        // 1. 尝试内嵌至库存顶部操作栏
        function tryInjectIntoNav() {
            if (document.getElementById('btn-sbs-nav-trigger')) return;

            // 常见的 Steam 库存顶部工具栏挂载点
            const targetContainers = [
                document.querySelector('.inventory_page_left'),
                document.querySelector('#inventory_logos'),
                document.querySelector('.inventory_filters'),
                document.querySelector('#inventory_item_search_filters')
            ];

            for (const container of targetContainers) {
                if (container) {
                    const btn = document.createElement('button');
                    btn.id = 'btn-sbs-nav-trigger';
                    btn.className = 'btn-bulk-seller-trigger';
                    btn.innerHTML = '⚡ 批量售卖';
                    btn.style.margin = '4px 8px';
                    btn.addEventListener('click', openModal);
                    container.prepend(btn);
                    console.log('[Steam Bulk Seller] 已在库存操作栏内嵌原生按钮。');
                    return;
                }
            }
        }

        // 2. 同时生成页面右下角保底悬浮按钮（双保险）
        if (!document.getElementById('btn-sbs-float-trigger')) {
            const floatBtn = document.createElement('button');
            floatBtn.id = 'btn-sbs-float-trigger';
            floatBtn.className = 'btn-bulk-seller-trigger btn-bulk-seller-floating';
            floatBtn.innerHTML = '⚡ 批量售卖工具';
            floatBtn.addEventListener('click', openModal);
            document.body.appendChild(floatBtn);
        }

        tryInjectIntoNav();

        // 3. 事件绑定
        // 搜索框过滤
        document.getElementById('sbs-search-box').addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (!query) {
                renderItemList(currentAggregatedItems);
                return;
            }
            const filtered = currentAggregatedItems.filter(item =>
                item.market_name.toLowerCase().includes(query) ||
                item.market_hash_name.toLowerCase().includes(query)
            );
            renderItemList(filtered);
        });

        // 刷新按钮
        document.getElementById('sbs-btn-reload-inv').addEventListener('click', refreshInventoryList);

        // 定价策略切换
        document.getElementById('sbs-strat-instant').addEventListener('click', () => applyPricingStrategy('instant'));
        document.getElementById('sbs-strat-undercut').addEventListener('click', () => applyPricingStrategy('undercut'));
        document.getElementById('sbs-strat-match').addEventListener('click', () => applyPricingStrategy('match'));

        // 实收价格变化联动买家支付
        document.getElementById('sbs-input-seller-price').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                const cents = Math.round(val * 100);
                const buyerPays = PricingEngine.calculateBuyerPays(cents);
                document.getElementById('sbs-input-buyer-price').value = (buyerPays / 100).toFixed(2);
            }
        });

        // 买家支付变化联动卖家实收 (二分算法)
        document.getElementById('sbs-input-buyer-price').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                const cents = Math.round(val * 100);
                const sellerReceives = PricingEngine.getOptimalSellerReceives(cents);
                document.getElementById('sbs-input-seller-price').value = (sellerReceives / 100).toFixed(2);
            }
        });

        // 数量快捷选择
        document.getElementById('sbs-chip-half').addEventListener('click', () => {
            if (selectedItem) {
                document.getElementById('sbs-input-sell-qty').value = Math.max(1, Math.floor(selectedItem.count / 2));
            }
        });
        document.getElementById('sbs-chip-all').addEventListener('click', () => {
            if (selectedItem) {
                document.getElementById('sbs-input-sell-qty').value = selectedItem.count;
            }
        });

        // 挂单延时间隔滑动条实时展示
        const delaySlider = document.getElementById('sbs-input-delay-slider');
        const delayValDisplay = document.getElementById('sbs-slider-delay-val');
        if (delaySlider && delayValDisplay) {
            delaySlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 1.0;
                delayValDisplay.textContent = `当前: ${val.toFixed(1)} 秒 (+0.1s 随机)`;
            });
        }

        // 开始售卖
        document.getElementById('sbs-btn-start-sell').addEventListener('click', startBatchSelling);
    }

    // 9. 启动加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountUiButtons);
    } else {
        mountUiButtons();
    }
})();
