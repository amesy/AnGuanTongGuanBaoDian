(() => {

    'use strict';


    // ==================================================
    // 页面防闪烁系统
    // ==================================================

    let pageReady = false;
    let revealTimer = null;


    // --------------------------------------------------
    // 尽可能早地隐藏页面
    // --------------------------------------------------

    function installPageProtection() {

        const style =
            document.createElement('style');

        style.id =
            'agt-page-protection-style';

        style.textContent = `

            html.agt-page-loading {
                visibility: hidden !important;
                background: #ffffff !important;
            }

            body.agt-page-loading {
                visibility: hidden !important;
                background: #ffffff !important;
            }

            #agt-page-shield {

                position: fixed !important;

                left: 0 !important;
                top: 0 !important;
                right: 0 !important;
                bottom: 0 !important;

                width: 100vw !important;
                height: 100vh !important;

                z-index: 2147483647 !important;

                background: #ffffff !important;

                display: flex !important;

                align-items: center !important;
                justify-content: center !important;

                pointer-events: all !important;

                font-family:
                    "Microsoft YaHei",
                    "Segoe UI",
                    sans-serif !important;

            }

            #agt-page-shield-text {

                font-size: 20px !important;

                color: #333333 !important;

                user-select: none !important;

            }

        `;


        // 尽早插入 head
        if (
            document.head
        ) {

            document.head.appendChild(
                style
            );

        } else if (
            document.documentElement
        ) {

            document.documentElement
                .appendChild(style);

        }


        // 给 html 加载状态
        if (
            document.documentElement
        ) {

            document.documentElement
                .classList
                .add(
                    'agt-page-loading'
                );

        }


        // body 如果已经存在，也加状态
        if (
            document.body
        ) {

            document.body
                .classList
                .add(
                    'agt-page-loading'
                );

        }

    }


    installPageProtection();


    // ==================================================
    // 创建遮罩
    // ==================================================

    function showPageShield() {

        if (
            document.getElementById(
                'agt-page-shield'
            )
        ) {
            return;
        }

        const shield =
            document.createElement('div');

        shield.id =
            'agt-page-shield';

        const text =
            document.createElement('div');

        text.id =
            'agt-page-shield-text';

        text.textContent =
            '';

        shield.appendChild(
            text
        );

        if (document.body) {

            document.body.appendChild(
                shield
            );

        }

    }


    // ==================================================
    // 隐藏版权
    // ==================================================

    function hideCopyright() {

        document
            .querySelectorAll(
                '.footer-top'
            )
            .forEach(
                element => {

                    element.style.setProperty(
                        'display',
                        'none',
                        'important'
                    );

                }
            );

    }


    // ==================================================
    // 隐藏登录页注册 / 忘记密码
    // ==================================================

    function hideLoginLinks() {

        document
            .querySelectorAll(
                '.forget'
            )
            .forEach(
                element => {

                    const text =
                        element.textContent ||
                        '';


                    if (
                        text.includes(
                            '注册账号'
                        ) ||
                        text.includes(
                            '忘记密码'
                        )
                    ) {

                        element.style.setProperty(
                            'display',
                            'none',
                            'important'
                        );

                    }

                }
            );

    }


    // ==================================================
    // 隐藏组织 ID
    // ==================================================

    function hideOrganizationId() {

        document
            .querySelectorAll(
                '.bj-form-item'
            )
            .forEach(
                element => {

                    const label =
                        element.querySelector(
                            '.el-form-item__label'
                        );


                    const input =
                        element.querySelector(
                            'input[placeholder="请输入您的组织ID"]'
                        );


                    if (
                        label &&
                        label.textContent
                            .trim() ===
                        '组织ID' &&
                        input
                    ) {

                        element.style.setProperty(
                            'display',
                            'none',
                            'important'
                        );


                        const parent =
                            element.parentElement;


                        if (
                            parent
                        ) {

                            const tip =
                                parent.querySelector(
                                    'p'
                                );


                            if (
                                tip &&
                                tip.textContent
                                    .includes(
                                        '不知道什么是组织ID'
                                    )
                            ) {

                                tip.style.setProperty(
                                    'display',
                                    'none',
                                    'important'
                                );

                            }

                        }

                    }

                }
            );

    }

    // ==================================================
    // 隐藏侧边栏指定导航
    // ==================================================

    function hideSidebarItems() {

        const hiddenPaths = [
            '/score/',
            '/notice/',
            '/contact/'
        ];

        document
            .querySelectorAll('a')
            .forEach(link => {

                const href =
                    link.getAttribute('href') || '';

                const text =
                    link.textContent.trim();

                const shouldHide =
                    hiddenPaths.some(path => {

                        return href === path;

                    }) ||
                    text.includes('我的积分') ||
                    text.includes('公告通知') ||
                    text.includes('联系我们');

                if (shouldHide) {

                    // 隐藏整个 <a>
                    link.style.setProperty(
                        'display',
                        'none',
                        'important'
                    );

                }

            });

    }

    // ==================================================
    // 隐藏账号信息中的“绑定手机”和“修改密码”
    // ==================================================

    function hideAccountOptions() {

        document
            .querySelectorAll('.el-form-item')
            .forEach(element => {

                const label =
                    element.querySelector(
                        '.el-form-item__label'
                    );

                if (!label) {
                    return;
                }

                const text =
                    label.textContent.trim();

                if (
                    text === '手机号码' ||
                    text === '修改密码'
                ) {

                    element.style.setProperty(
                        'display',
                        'none',
                        'important'
                    );

                }

            });

    }

    // ==================================================
    // 隐藏“学员专用”
    // ==================================================

    function hideLogoTip() {

        document
            .querySelectorAll('.logo-tip')
            .forEach(element => {

                if (
                    element.textContent.trim() === '学员专用'
                ) {

                    element.style.setProperty(
                        'display',
                        'none',
                        'important'
                    );

                }

            });

    }

    // ==================================================
    // 隐藏“未分类”所在的整个树节点
    // ==================================================

    function hideUnclassified() {

        document
            .querySelectorAll('.custom-tree-label')
            .forEach(element => {

                if (
                    element.textContent.trim() === '未分类'
                ) {

                    const treeNode =
                        element.closest(
                            '.el-tree-node__content'
                        );

                    if (treeNode) {

                        treeNode.style.setProperty(
                            'display',
                            'none',
                            'important'
                        );

                    }

                }

            });

    }

    // ==================================================
    // 替换品牌文字
    // ==================================================

    function replaceBrandText(
        text
    ) {

        if (
            !text ||
            typeof text !== 'string'
        ) {

            return text;

        }


        return text
            .replace(
                /考试宝企业版/g,
                '安管通关宝典'
            )
            .replace(
                /考试宝/g,
                '安管通关宝典'
            );

    }


    // ==================================================
    // 替换普通文本
    // ==================================================

    function replaceTextNodes(
        root
    ) {

        if (
            !root
        ) {

            return;

        }


        const walker =
            document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT
            );


        const nodes = [];


        let node;


        while (
            node =
            walker.nextNode()
        ) {

            nodes.push(
                node
            );

        }


        nodes.forEach(
            textNode => {

                const oldText =
                    textNode.nodeValue;


                const newText =
                    replaceBrandText(
                        oldText
                    );


                if (
                    newText !==
                    oldText
                ) {

                    textNode.nodeValue =
                        newText;

                }

            }
        );

    }


    // ==================================================
    // 替换 HTML 属性
    // ==================================================

    function replaceAttributes(
        root
    ) {

        if (
            !root
        ) {

            return;

        }


        const elements =
            root.querySelectorAll
                ? root.querySelectorAll('*')
                : [];


        elements.forEach(
            element => {

                [
                    'title',
                    'placeholder',
                    'aria-label',
                    'alt'
                ]
                    .forEach(
                        attribute => {

                            if (
                                !element.hasAttribute(
                                    attribute
                                )
                            ) {

                                return;

                            }


                            const oldValue =
                                element.getAttribute(
                                    attribute
                                );


                            const newValue =
                                replaceBrandText(
                                    oldValue
                                );


                            if (
                                newValue !==
                                oldValue
                            ) {

                                element.setAttribute(
                                    attribute,
                                    newValue
                                );

                            }

                        }
                    );


                // ----------------------------------
                // input / textarea
                // ----------------------------------

                if (
                    element instanceof
                    HTMLInputElement ||
                    element instanceof
                    HTMLTextAreaElement
                ) {

                    if (
                        typeof element.value ===
                        'string'
                    ) {

                        const newValue =
                            replaceBrandText(
                                element.value
                            );


                        if (
                            newValue !==
                            element.value
                        ) {

                            element.value =
                                newValue;

                        }

                    }

                }

            }
        );

    }


    // ==================================================
    // 修改网页 Title
    // ==================================================

    function cleanPageTitle() {

        const targetTitle =
            '安管通关宝典';


        if (
            document.title !==
            targetTitle
        ) {

            document.title =
                targetTitle;

        }

    }


    // ==================================================
    // 页面统一清理
    // ==================================================

    function cleanPage() {

        hideCopyright();

        hideLoginLinks();

        hideOrganizationId();

        hideSidebarItems();

        hideAccountOptions();

        hideLogoTip();

        hideUnclassified();

        cleanPageTitle();

        replaceTextNodes(
            document.body
        );

        replaceAttributes(
            document.body
        );

    }


    // ==================================================
    // 页面最终显示
    // ==================================================

    function revealPage() {

        if (
            pageReady
        ) {

            return;

        }


        cleanPage();


        // 再等两帧
        requestAnimationFrame(
            () => {

                requestAnimationFrame(
                    () => {

                        cleanPage();


                        const shield =
                            document.getElementById(
                                'agt-page-shield'
                            );


                        if (
                            shield
                        ) {

                            shield.remove();

                        }


                        if (
                            document.body
                        ) {

                            document.body
                                .classList
                                .remove(
                                    'agt-page-loading'
                                );

                        }


                        if (
                            document.documentElement
                        ) {

                            document.documentElement
                                .classList
                                .remove(
                                    'agt-page-loading'
                                );

                        }


                        pageReady = true;

                    }
                );

            }
        );

    }


    // ==================================================
    // DOM 准备完成
    // ==================================================

    function initializePage() {

        showPageShield();

        cleanPage();


        // 给 Vue / Nuxt 一点时间完成首轮渲染
        setTimeout(
            () => {

                revealPage();

            },
            80
        );

    }


    // ==================================================
    // 首次初始化
    // ==================================================

    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            initializePage,
            {
                once: true
            }
        );

    } else {

        initializePage();

    }


    // ==================================================
    // MutationObserver
    // ==================================================
    //
    // 注意：
    // 不再因为普通 DOM 变化重新显示页面遮罩。
    // 否则登录失败弹窗、关闭弹窗、输入框变化等
    // 都可能触发遮罩，导致输入框无法继续操作。
    // ==================================================

    const observer =
        new MutationObserver(
            () => {

                // 页面已经显示以后，
                // 后续只负责执行页面清理。
                //
                // 不再调用：
                // showPageShield()
                // pageReady = false
                // revealPage()
                //
                // 这样可以避免登录失败后输入框被遮罩挡住。

                cleanPage();

            }
        );


    function startObserver() {

        if (
            !document.documentElement
        ) {

            return;

        }


        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );
    }

    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            startObserver,
            {
                once: true
            }
        );

    } else {

        startObserver();

    }


    // ==================================================
    // 定时保险
    //
    // 每 2 秒执行一次页面清理，确保动态内容也被处理。
    // 相比 1 秒执行一次，可以降低 CPU 使用率。
    // ==================================================

    setInterval(
        () => {

            cleanPage();

        },
        2000
    );


    // ==================================================
    // 禁止右键
    // ==================================================

    document.addEventListener(
        'contextmenu',
        event => {

            event.preventDefault();

            event.stopPropagation();

        },
        true
    );


    // ==================================================
    // 禁止开发者工具快捷键
    // ==================================================

    document.addEventListener(
        'keydown',
        event => {

            const key =
                event.key.toLowerCase();


            // F12
            if (
                event.key ===
                'F12'
            ) {

                event.preventDefault();

                event.stopPropagation();

                return false;

            }


            // Ctrl + Shift + I
            if (
                event.ctrlKey &&
                event.shiftKey &&
                key === 'i'
            ) {

                event.preventDefault();

                event.stopPropagation();

                return false;

            }


            // Ctrl + Shift + J
            if (
                event.ctrlKey &&
                event.shiftKey &&
                key === 'j'
            ) {

                event.preventDefault();

                event.stopPropagation();

                return false;

            }


            // Ctrl + U
            if (
                event.ctrlKey &&
                key === 'u'
            ) {

                event.preventDefault();

                event.stopPropagation();

                return false;

            }

        },
        true
    );


})();