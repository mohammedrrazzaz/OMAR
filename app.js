// المنطق التفاعلي ومحرك الذكاء الاصطناعي لتطبيق "منصة حلول AI"

document.addEventListener("DOMContentLoaded", () => {
  // الحالة العامة للتطبيق
  let activeCategoryId = APP_DATA.categories[0].id;
  let activeSubIssue = APP_DATA.categories[0].subIssues[0];
  let currentDisplayedPlan = null;

  // حالة محاكي المفاوضات
  let activeScenario = APP_DATA.negotiations[0];
  let simStepIndex = 0;
  let simTrustScore = activeScenario.initialTrust;

  // حالة الذكاء الاصطناعي
  const AI_KEY_STORAGE = "hulool_gemini_api_key";
  const AI_MODE_STORAGE = "hulool_ai_mode";
  let lastAiExtractedPlan = null;
  let chatHistoryContext = [];

  // حالة لوحة المتابعة (LocalStorage)
  const STORAGE_KEY = "hulool_saved_cases_v1";
  let savedCases = loadCasesFromStorage();

  // حالة الاشتراكات والباقات
  const SUB_STORAGE_KEY = "hulool_active_subscription_v1";
  let billingPeriod = "monthly"; // monthly | yearly
  let activeCurrency = "SAR";
  let userSubscription = loadSubscriptionFromStorage();
  let selectedPlanForCheckout = null;
  let appliedPromoDiscount = 0; // 0 to 0.5

  // ==================== 1. التهيئة والتنقل والمظهر ====================
  initTabs();
  initTheme();
  initAiSettingsModal();
  renderCategories();
  renderSubIssues(activeCategoryId);
  renderSolutionPlan(activeSubIssue, activeCategoryId);
  initCustomDiagnosisForm();
  initAiChatEngine();
  initVoiceRecognition();
  initTemplatesEngine();
  initNegotiationSimulator();
  initCaseTracker();
  initSubscriptionsEngine();

  function initTabs() {
    const tabs = document.querySelectorAll(".nav-tab");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-tab");
        switchToTab(target);
      });
    });
  }

  function switchToTab(tabName) {
    document.querySelectorAll(".nav-tab").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-tab") === tabName);
    });
    document.querySelectorAll(".tab-section").forEach((sec) => {
      sec.classList.toggle("active", sec.id === `tab-${tabName}`);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function initTheme() {
    const themeBtn = document.getElementById("themeToggleBtn");
    const savedTheme = localStorage.getItem("hulool_theme");
    if (savedTheme === "dark") {
      document.body.classList.add("dark-mode");
      updateThemeBtnLabel(true);
    }
    themeBtn.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark-mode");
      localStorage.setItem("hulool_theme", isDark ? "dark" : "light");
      updateThemeBtnLabel(isDark);
    });
  }

  function updateThemeBtnLabel(isDark) {
    const themeBtn = document.getElementById("themeToggleBtn");
    themeBtn.innerHTML = isDark
      ? `<i class="fa-solid fa-sun"></i> <span>المظهر النهاري</span>`
      : `<i class="fa-solid fa-moon"></i> <span>المظهر الليلي</span>`;
  }

  function showToast(message) {
    const toast = document.getElementById("toastNotification");
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3400);
  }

  // ==================== 2. إعدادات ومحرك الذكاء الاصطناعي (AI Engine) ====================
  function initAiSettingsModal() {
    const modal = document.getElementById("aiSettingsModal");
    const openBtn1 = document.getElementById("aiConfigBtn");
    const openBtn2 = document.getElementById("openAiSettingsFromChatBtn");
    const closeBtn = document.getElementById("closeAiModalBtn");
    const cancelBtn = document.getElementById("cancelAiModalBtn");
    const saveBtn = document.getElementById("saveAiSettingsBtn");
    const keyInput = document.getElementById("geminiApiKeyInput");
    const modeSelect = document.getElementById("aiModeSelect");

    keyInput.value = localStorage.getItem(AI_KEY_STORAGE) || "";
    modeSelect.value = localStorage.getItem(AI_MODE_STORAGE) || "hybrid";
    updateAiStatusBadge();

    const openModal = () => modal.classList.remove("hidden");
    const closeModal = () => modal.classList.add("hidden");

    if (openBtn1) openBtn1.addEventListener("click", openModal);
    if (openBtn2) openBtn2.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);

    saveBtn.addEventListener("click", () => {
      localStorage.setItem(AI_KEY_STORAGE, keyInput.value.trim());
      localStorage.setItem(AI_MODE_STORAGE, modeSelect.value);
      updateAiStatusBadge();
      closeModal();
      showToast("تم حفظ إعدادات محرك الذكاء الاصطناعي بنجاح!");
    });
  }

  function updateAiStatusBadge() {
    const statusText = document.getElementById("aiEngineStatusText");
    const apiKey = localStorage.getItem(AI_KEY_STORAGE) || "";
    const mode = localStorage.getItem(AI_MODE_STORAGE) || "hybrid";
    if (mode === "hybrid" && apiKey.length > 10) {
      statusText.textContent = "Gemini AI المتصل: نشط";
    } else {
      statusText.textContent = "محرك AI الذكي المدمج: نشط";
    }
  }

  // خوارزمية الذكاء الاصطناعي لتحليل النص العربي واكتشاف القطاع والأولوية
  function analyzeArabicProblemNLP(text) {
    const lower = text.toLowerCase();
    const rules = [
      {
        id: "family",
        keywords: ["زوج", "زوجت", "طلاق", "أبناء", "ابني", "مراهق", "عائل", "أسر", "ميراث", "ورث", "أهل", "أقارب", "نفقة", "بيت"],
        defaultSub: "marital_comm"
      },
      {
        id: "school",
        keywords: ["مدرس", "طالب", "معلم", "تنمر", "درجات", "اختبار", "فصل دراسي", "مذاكر", "تحصيل", "مرشد", "جامعة", "كلية"],
        defaultSub: "school_bullying"
      },
      {
        id: "employment",
        keywords: ["وظيف", "راتب", "مدير", "شرك", "عمل", "فصل تعسفي", "استقال", "ترقي", "موارد بشرية", "دوام", "عقد عمل", "مستحقات"],
        defaultSub: "unfair_dismissal"
      },
      {
        id: "government",
        keywords: ["حكوم", "معامل", "مخالف", "غرامة", "وزار", "بلدي", "مرور", "اعتراض", "تظلم إداري", "قرار", "موظف حكومي", "برقية"],
        defaultSub: "delayed_transaction"
      },
      {
        id: "international",
        keywords: ["سفر", "جواز", "تأشير", "فيزا", "سفار", "قنصلي", "طيران", "رحل", "حقيب", "أمتع", "خارج", "دولي", "مطار"],
        defaultSub: "visa_rejection"
      },
      {
        id: "general",
        keywords: ["متجر", "سلع", "ضمان", "استرجاع", "غش", "جار", "جيران", "إزعاج", "احتيال", "نصب", "ابتزاز", "تهكير", "ديون", "قرض", "بنك"],
        defaultSub: "consumer_dispute"
      }
    ];

    let bestSector = "general";
    let maxScore = 0;

    rules.forEach((r) => {
      let score = 0;
      r.keywords.forEach((kw) => {
        if (lower.includes(kw)) score += 2;
      });
      if (score > maxScore) {
        maxScore = score;
        bestSector = r.id;
      }
    });

    // تحديد درجة الأولوية من الكلمات الدلالية
    const highUrgencyWords = ["فصل", "تهديد", "ابتزاز", "احتيال", "تنمر", "فقدان", "سرقة", "عاجل", "رفض", "تأخر راتب", "غرامة", "شرطة", "محكمة"];
    let urgency = "متوسطة";
    if (highUrgencyWords.some((w) => lower.includes(w))) {
      urgency = "عالية";
    }

    const categoryObj = APP_DATA.categories.find((c) => c.id === bestSector) || APP_DATA.categories[0];

    // البحث عن أقرب مشكلة فرعية في هذا القطاع
    let matchedSub = categoryObj.subIssues[0];
    let bestSubScore = -1;
    categoryObj.subIssues.forEach((sub) => {
      let sScore = 0;
      const tokens = (sub.title + " " + sub.summary).split(/\s+/);
      tokens.forEach((tok) => {
        if (tok.length > 3 && lower.includes(tok)) sScore++;
      });
      if (sScore > bestSubScore) {
        bestSubScore = sScore;
        matchedSub = sub;
      }
    });

    return {
      sectorId: bestSector,
      categoryName: categoryObj.name,
      urgency,
      matchedSub
    };
  }

  // استدعاء الذكاء الاصطناعي (Gemini API إن توفر، أو المحرك الذكي المدمج)
  async function generateAiAdvisorResponse(userMessage) {
    const apiKey = localStorage.getItem(AI_KEY_STORAGE) || "";
    const mode = localStorage.getItem(AI_MODE_STORAGE) || "hybrid";
    const nlp = analyzeArabicProblemNLP(userMessage);

    // تحديث خطة الذكاء الاصطناعي المستخرجة للشريط الجانبي
    lastAiExtractedPlan = {
      title: userMessage.length > 55 ? userMessage.slice(0, 55) + "..." : userMessage,
      categoryId: nlp.sectorId,
      categoryName: nlp.categoryName,
      urgency: nlp.urgency,
      summary: `تحليل ذكاء اصطناعي للمشكلة: ${userMessage}`,
      steps: nlp.matchedSub.steps,
      detailsText: userMessage
    };

    // إذا كان مفتاح Gemini API متوفراً والوضع هجين
    if (mode === "hybrid" && apiKey.length > 10) {
      try {
        const sysInstruction = `أنت "المستشار الذكي في منصة حلول" المتخصص في حل المشاكل العائلية، المدرسية، التوظيفية، الحكومية، الدولية، والعامة.
قدّم إجابة عربية منظمة ومختصرة وعملية جداً تتضمن:
1. التشخيص الذكي للمشكلة وأسبابها.
2. خطة العمل المرحلية (خطوات مرقمة واضحة: عاجلة، إجرائية، ونظامية).
3. صياغة مقترحة لعبارة حوارية دبلوماسية أو نص رسالة رسمية.
4. نصيحة أو تحذير قانوني/تربوي مهم.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [{ text: `${sysInstruction}\n\nمشكلة المستخدم: ${userMessage}` }]
                }
              ]
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiText) {
            return {
              html: formatMarkdownToHtml(aiText),
              nlp
            };
          }
        }
      } catch (err) {
        console.warn("Gemini API fallback to built-in AI engine:", err);
      }
    }

    // المحرك الاستنتاجي الذكي المدمج (يعمل دائماً وبسرعة فائقة)
    await new Promise((r) => setTimeout(r, 650)); // محاكاة معالجة ذكية سلسة
    const sub = nlp.matchedSub;
    const stepsListHtml = sub.steps
      .map((s) => `<li><strong>[${s.phase}] ${s.title}:</strong> ${s.desc}</li>`)
      .join("");

    const warningsListHtml = sub.warnings.map((w) => `<li>${w}</li>`).join("");

    const html = `
      <p>أهلاً بك. قمت بتحليل مشكلتك بالذكاء الاصطناعي وتصنيفها ضمن <strong>(${nlp.categoryName})</strong> بمستوى أولوية <strong>(${nlp.urgency})</strong>.</p>
      <h5><i class="fa-solid fa-microscope"></i> 1. التشخيص الذكي للموقف:</h5>
      <p>${sub.summary}، وغالباً ما ترتبط هذه الحالة بـ: ${sub.rootCauses.join("، ")}.</p>
      <h5><i class="fa-solid fa-list-ol"></i> 2. خطة الحل المرحلية الموصى بها:</h5>
      <ol>${stepsListHtml}</ol>
      <h5><i class="fa-solid fa-triangle-exclamation"></i> 3. تنبيهات ومحاذير هامة:</h5>
      <ul>${warningsListHtml}</ul>
      <h5><i class="fa-solid fa-scale-balanced"></i> 4. السند والتوجيه الإجرائي:</h5>
      <p>${sub.legalOrOfficialNote}</p>
      <p style="margin-top:8px; font-size:0.85rem; color:var(--primary);">
        <i class="fa-solid fa-wand-magic-sparkles"></i> يمكنك الضغط على الأزرار في اللوحة الجانبية اليسرى لتحويل هذه الخطة فوراً إلى <strong>لوحة المتابعة</strong> أو <strong>توليد خطاب رسمي جاهز</strong>.
      </p>
    `;

    return { html, nlp };
  }

  function formatMarkdownToHtml(md) {
    const escaped = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return escaped
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^###\s+(.+)$/gm, "<h5>$1</h5>")
      .replace(/^##\s+(.+)$/gm, "<h5>$1</h5>")
      .replace(/\n/g, "<br>");
  }

  // ==================== 3. محادثة المستشار الذكي (AI Chat Tab) ====================
  function initAiChatEngine() {
    const chatBox = document.getElementById("aiChatMessages");
    const chatForm = document.getElementById("aiChatForm");
    const chatInput = document.getElementById("aiChatInput");
    const thinkingEl = document.getElementById("aiThinkingIndicator");
    const clearBtn = document.getElementById("clearAiChatBtn");
    const saveTrackerBtn = document.getElementById("aiSaveToTrackerBtn");
    const convertLetterBtn = document.getElementById("aiConvertToLetterBtn");

    function addWelcomeMessage() {
      chatBox.innerHTML = "";
      appendChatBubble(
        "bot",
        `<p>مرحباً بك في <strong>المستشار الذكي (حُلُول AI)</strong> 🤖</p>
         <p>أنا مدرب على تحليل وحل المشكلات في <strong>6 قطاعات رئيسية</strong>: (العائلية، المدرسية، التوظيفية، الحكومية، الدولية، والعامة).</p>
         <p>اكتب مشكلتك بالتفصيل أو اضغط على زر المايكروفون 🎤 للتحدث صوتياً، أو اختر أحد الأمثلة السريعة بالأعلى وسأقوم بتشخيصها وبناء خطة الحل فوراً.</p>`
      );
    }

    addWelcomeMessage();

    clearBtn.addEventListener("click", () => {
      chatHistoryContext = [];
      lastAiExtractedPlan = null;
      document.getElementById("aiDetectedSector").textContent = "بانتظار طرح المشكلة...";
      document.getElementById("aiDetectedUrgency").textContent = "—";
      document.getElementById("aiDetectedAction").textContent =
        "اطرح مشكلتك في الشات ليقوم الذكاء الاصطناعي باستخلاص خطة العمل هنا.";
      saveTrackerBtn.disabled = true;
      convertLetterBtn.disabled = true;
      addWelcomeMessage();
      showToast("تم بدء جلسة محادثة ذكية جديدة");
    });

    // الأزرار السريعة (Prompt Chips)
    document.querySelectorAll(".prompt-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const promptText = chip.getAttribute("data-prompt");
        chatInput.value = promptText;
        chatForm.dispatchEvent(new Event("submit"));
      });
    });

    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      appendChatBubble("user", `<p>${escapeHtml(text)}</p>`);
      chatInput.value = "";
      thinkingEl.classList.remove("hidden");

      const result = await generateAiAdvisorResponse(text);
      thinkingEl.classList.add("hidden");

      appendChatBubble("bot", result.html);

      // تحديث بطاقة التحليل اللحظي
      document.getElementById("aiDetectedSector").textContent = result.nlp.categoryName;
      document.getElementById("aiDetectedUrgency").textContent = result.nlp.urgency;
      document.getElementById("aiDetectedAction").textContent =
        result.nlp.matchedSub.steps.map((s) => s.title).join(" ← ");

      saveTrackerBtn.disabled = false;
      convertLetterBtn.disabled = false;
    });

    saveTrackerBtn.addEventListener("click", () => {
      if (!lastAiExtractedPlan) return;
      const newCase = {
        id: "case_" + Date.now(),
        title: lastAiExtractedPlan.title,
        category: lastAiExtractedPlan.categoryId,
        categoryName: lastAiExtractedPlan.categoryName,
        urgency: lastAiExtractedPlan.urgency,
        createdAt: new Date().toISOString().slice(0, 10),
        status: "in_progress",
        tasks: lastAiExtractedPlan.steps.map((s) => ({
          text: `${s.title} — ${s.desc}`,
          done: false
        })),
        notes: lastAiExtractedPlan.summary
      };
      savedCases.unshift(newCase);
      saveCasesToStorage();
      renderCasesTracker();
      showToast("تم تحويل خطة الذكاء الاصطناعي إلى لوحة المتابعة!");
      switchToTab("tracker");
    });

    convertLetterBtn.addEventListener("click", () => {
      if (!lastAiExtractedPlan) return;
      const matchingTpl =
        APP_DATA.templates.find((t) => t.category === lastAiExtractedPlan.categoryId) ||
        APP_DATA.templates[0];
      document.getElementById("templateSelect").value = matchingTpl.id;
      document.getElementById("tplDetails").value = lastAiExtractedPlan.detailsText;
      updateLetterPreview();
      switchToTab("templates");
      showToast("تم تحويل تفاصيل المحادثة إلى نموذج خطاب رسمي!");
    });
  }

  function appendChatBubble(sender, htmlContent) {
    const chatBox = document.getElementById("aiChatMessages");
    const msgDiv = document.createElement("div");
    msgDiv.className = `ai-msg ${sender === "bot" ? "ai-msg-bot" : "ai-msg-user"}`;

    const icon = sender === "bot" ? "fa-robot" : "fa-user";
    msgDiv.innerHTML = `
      <div class="ai-avatar"><i class="fa-solid ${icon}"></i></div>
      <div class="ai-bubble">${htmlContent}</div>
    `;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ==================== 4. الإملاء الصوتي بالذكاء الاصطناعي (Web Speech API) ====================
  function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const voiceDiagBtn = document.getElementById("voiceDiagBtn");
    const aiVoiceInputBtn = document.getElementById("aiVoiceInputBtn");

    function bindVoiceButton(btn, targetInputId) {
      if (!btn) return;
      btn.addEventListener("click", () => {
        if (!SpeechRecognition) {
          showToast("متصفحك لا يدعم الإملاء الصوتي المباشر؛ جرب متصفح Chrome أو Edge.");
          return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = "ar-SA";
        recognition.interimResults = false;

        btn.classList.add("recording");
        showToast("🎤 جاري الاستماع... تحدث الآن بشرح مشكلتك");

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          const targetEl = document.getElementById(targetInputId);
          targetEl.value = (targetEl.value ? targetEl.value + " " : "") + transcript;
          showToast("تم تحويل صوتك إلى نص بنجاح!");
        };

        recognition.onerror = () => {
          btn.classList.remove("recording");
          showToast("تعذر التقاط الصوت، تأكد من السماح بالمايكروفون.");
        };

        recognition.onend = () => {
          btn.classList.remove("recording");
        };

        recognition.start();
      });
    }

    bindVoiceButton(voiceDiagBtn, "diagDetails");
    bindVoiceButton(aiVoiceInputBtn, "aiChatInput");
  }

  // ==================== 5. المستشار الذكي والتشخيص ====================
  function renderCategories() {
    const grid = document.getElementById("categoryGrid");
    grid.innerHTML = "";
    APP_DATA.categories.forEach((cat) => {
      const card = document.createElement("div");
      card.className = `category-card ${cat.id === activeCategoryId ? "active" : ""}`;
      card.style.setProperty("--cat-color", cat.color);
      card.style.setProperty("--cat-bg", cat.bgLight);

      card.innerHTML = `
        <div class="cat-icon-wrap" style="background:${cat.bgLight}; color:${cat.color}">
          <i class="fa-solid ${cat.icon}"></i>
        </div>
        <div>
          <h4>${cat.name}</h4>
          <p>${cat.description}</p>
        </div>
      `;

      card.addEventListener("click", () => {
        activeCategoryId = cat.id;
        activeSubIssue = cat.subIssues[0];
        document.getElementById("diagSector").value = cat.id;
        renderCategories();
        renderSubIssues(cat.id);
        renderSolutionPlan(activeSubIssue, cat.id);
      });

      grid.appendChild(card);
    });
  }

  function renderSubIssues(categoryId) {
    const category = APP_DATA.categories.find((c) => c.id === categoryId);
    if (!category) return;

    const titleEl = document.getElementById("selectedCategoryTitle");
    titleEl.innerHTML = `<i class="fa-solid ${category.icon}" style="color:${category.color}"></i> مشكلات شائعة: ${category.name}`;

    const listEl = document.getElementById("subIssuesList");
    listEl.innerHTML = "";

    category.subIssues.forEach((issue) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `sub-issue-btn ${activeSubIssue && activeSubIssue.id === issue.id ? "active" : ""}`;
      btn.innerHTML = `
        <span class="sub-issue-title">${issue.title}</span>
        <i class="fa-solid fa-chevron-left" style="font-size:0.8rem; opacity:0.65;"></i>
      `;
      btn.addEventListener("click", () => {
        activeSubIssue = issue;
        renderSubIssues(categoryId);
        renderSolutionPlan(issue, categoryId);
      });
      listEl.appendChild(btn);
    });
  }

  function renderSolutionPlan(planObj, categoryId) {
    currentDisplayedPlan = { ...planObj, categoryId };
    const category = APP_DATA.categories.find((c) => c.id === categoryId) || APP_DATA.categories[0];
    const container = document.getElementById("solutionPlanContainer");

    const urgencyClass =
      planObj.urgency === "عالية"
        ? "badge-high"
        : planObj.urgency === "متوسطة"
        ? "badge-medium"
        : "badge-low";

    const causesHtml = (planObj.rootCauses || [])
      .map((c) => `<span class="cause-tag"><i class="fa-solid fa-magnifying-glass-chart"></i> ${c}</span>`)
      .join("");

    const stepsHtml = (planObj.steps || [])
      .map(
        (step, idx) => `
        <div class="step-item">
          <div class="step-number">${idx + 1}</div>
          <div class="step-content">
            <div class="step-top">
              <h5>${step.title}</h5>
              <span class="step-phase">${step.phase}</span>
            </div>
            <p>${step.desc}</p>
          </div>
        </div>
      `
      )
      .join("");

    const warningsHtml = (planObj.warnings || [])
      .map((w) => `<li>${w}</li>`)
      .join("");

    container.innerHTML = `
      <div class="solution-header">
        <div class="solution-meta">
          <span class="badge badge-primary"><i class="fa-solid ${category.icon}"></i> ${category.name}</span>
          <span class="badge ${urgencyClass}"><i class="fa-solid fa-circle-exclamation"></i> الأولوية: ${planObj.urgency}</span>
          ${planObj.isCustom ? `<span class="badge badge-low"><i class="fa-solid fa-robot"></i> تشخيص بالذكاء الاصطناعي</span>` : ""}
        </div>
        <h3>${planObj.title}</h3>
        <p class="solution-summary">${planObj.summary}</p>
      </div>

      <div class="solution-block">
        <h4><i class="fa-solid fa-diagram-project" style="color:var(--primary)"></i> التشخيص والأسباب الجذرية المحتملة</h4>
        <div class="causes-tags">${causesHtml}</div>
      </div>

      <div class="solution-block">
        <h4><i class="fa-solid fa-route" style="color:var(--success)"></i> خطة العمل المرحلية المقترحة (خطوة بخطوة)</h4>
        <div class="steps-timeline">${stepsHtml}</div>
      </div>

      <div class="alert-box alert-warning">
        <h5><i class="fa-solid fa-triangle-exclamation"></i> محاذير وأخطاء شائعة يجب تجنبها</h5>
        <ul>${warningsHtml}</ul>
      </div>

      <div class="alert-box alert-legal">
        <h5><i class="fa-solid fa-scale-balanced"></i> التوجيه النظامي / الإجرائي</h5>
        <p>${planObj.legalOrOfficialNote}</p>
      </div>

      <div class="solution-actions">
        <button id="addPlanToTrackerBtn" class="btn btn-success">
          <i class="fa-solid fa-list-check"></i> إضافة الخطة إلى لوحة المتابعة
        </button>
        <button id="openTemplateForPlanBtn" class="btn btn-outline">
          <i class="fa-solid fa-file-signature"></i> توليد خطاب رسمي لهذه المشكلة
        </button>
        <button id="discussInAiChatBtn" class="btn btn-primary">
          <i class="fa-solid fa-robot"></i> مناقشة المشكلة مع المستشار الذكي (AI)
        </button>
      </div>
    `;

    // ربط زر إضافة الخطة إلى لوحة المتابعة
    document.getElementById("addPlanToTrackerBtn").addEventListener("click", () => {
      const newCase = {
        id: "case_" + Date.now(),
        title: planObj.title,
        category: categoryId,
        categoryName: category.name,
        urgency: planObj.urgency,
        createdAt: new Date().toISOString().slice(0, 10),
        status: "in_progress",
        tasks: (planObj.steps || []).map((s) => ({
          text: `${s.title} — ${s.desc}`,
          done: false
        })),
        notes: planObj.summary
      };
      savedCases.unshift(newCase);
      saveCasesToStorage();
      renderCasesTracker();
      showToast("تمت إضافة خطة الحل إلى لوحة المتابعة بنجاح!");
      switchToTab("tracker");
    });

    // ربط زر توليد خطاب رسمي لهذه المشكلة
    document.getElementById("openTemplateForPlanBtn").addEventListener("click", () => {
      const matchingTpl = APP_DATA.templates.find((t) => t.category === categoryId) || APP_DATA.templates[0];
      const selectEl = document.getElementById("templateSelect");
      selectEl.value = matchingTpl.id;
      document.getElementById("tplDetails").value = `${planObj.title}: ${planObj.summary}`;
      updateLetterPreview();
      switchToTab("templates");
      showToast("تم تجهيز قالب الخطاب الرسمي المناسب لمشكلتك");
    });

    // ربط زر المناقشة مع الذكاء الاصطناعي
    document.getElementById("discussInAiChatBtn").addEventListener("click", () => {
      switchToTab("aichat");
      const chatInput = document.getElementById("aiChatInput");
      chatInput.value = `أريد خطة تفصيلية ونصائح حوارية لحل مشكلة: ${planObj.title} (${planObj.summary})`;
      document.getElementById("aiChatForm").dispatchEvent(new Event("submit"));
    });
  }

  // محرك التشخيص التفاعلي المخصص بالذكاء الاصطناعي
  function initCustomDiagnosisForm() {
    const form = document.getElementById("customDiagnosisForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let sector = document.getElementById("diagSector").value;
      const title = document.getElementById("diagTitle").value.trim();
      const urgency = document.getElementById("diagUrgency").value;
      const stage = document.getElementById("diagStage").value;
      const goal = document.getElementById("diagGoal").value;
      const details = document.getElementById("diagDetails").value.trim();

      if (!title) return;

      // استنتاج إضافي بالذكاء الاصطناعي من النص المكتوب
      const nlp = analyzeArabicProblemNLP(title + " " + details);

      const customPlan = buildCustomActionPlan({
        sector,
        title,
        urgency,
        stage,
        goal,
        details,
        nlpMatchedSub: nlp.matchedSub
      });
      activeCategoryId = sector;
      activeSubIssue = null;
      renderCategories();
      renderSubIssues(sector);
      renderSolutionPlan(customPlan, sector);
      showToast("تم تحليل المشكلة بالذكاء الاصطناعي وتوليد خطة الحل!");
    });
  }

  function buildCustomActionPlan({ sector, title, urgency, stage, goal, details, nlpMatchedSub }) {
    const stageLabels = {
      beginning: "المشكلة في بدايتها ولم يتم فتح حوار رسمي بعد",
      discussed: "تم النقاش شفوياً دون الوصول لحل عملي",
      escalated: "وصلت لمرحلة نزاع يتطلب توثيقاً وإجراءً رسمياً"
    };

    const goalLabels = {
      peaceful: "الوصول إلى تسوية ودية تحفظ العلاقة والود",
      official: "استرداد الحق النظامي وتوثيق الإجراءات رسمياً",
      protection: "إيقاف الضرر بشكل عاجل وتأمين الحماية النظامية"
    };

    const steps = [];

    if (stage === "beginning") {
      steps.push({
        title: "حصر الوقائع وتجهيز نقاط الحوار الهادئ",
        desc: "تدوين النقاط الأساسية والأمثلة المحددة قبل مفاتحة الطرف الآخر لضمان وضوح الرسالة.",
        phase: "عاجل"
      });
    } else {
      steps.push({
        title: "توثيق كافة المحاولات السابقة والمستندات المؤيدة",
        desc: "جمع المراسلات، التواريخ، والوثائق في ملف مرتب تمهيداً للخطوة الإجرائية المكتوبة.",
        phase: "عاجل"
      });
    }

    // دمج خطوة تخصصية ذكية من أقرب حالة في قاعدة المعرفة
    if (nlpMatchedSub && nlpMatchedSub.steps && nlpMatchedSub.steps[1]) {
      steps.push(nlpMatchedSub.steps[1]);
    }

    if (goal === "peaceful") {
      steps.push({
        title: "عقد جلسة حوار مباشرة أو عبر وسيط مقبول للطرفين",
        desc: "عرض المشكلة بلغة المصالح المشتركة واقتراح حل عملي قابل للتجربة لفترة محددة.",
        phase: "متوسط"
      });
    } else if (goal === "official") {
      steps.push({
        title: "توجيه خطاب رسمي مكتوب ومقيد برقم مرجعي",
        desc: "استخدام مولد النماذج بالذكاء الاصطناعي لصياغة مطالبة أو تظلم رسمي وتحديد مهلة للرد.",
        phase: "إجرائي"
      });
    } else {
      steps.push({
        title: "اتخاذ إجراء الحماية الفوري وإبلاغ الجهة المختصة",
        desc: "إيقاف التعامل المسبب للضرر فوراً وتقديم بلاغ رسمي عاجل للجهة الإشرافية أو المختصة.",
        phase: "حماية عاجلة"
      });
    }

    const sectorStepMap = {
      family: {
        title: "صياغة وثيقة تفاهم عائلي واضح البنود",
        desc: "تثبيت ما يتم الاتفاق عليه كتابةً أو الاستعانة بمركز إرشاد وإصلاح أسري معتمد.",
        phase: "مستدام"
      },
      school: {
        title: "متابعة التطبيق مع المرشد الطلابي وإدارة المدرسة",
        desc: "التأكد من تفعيل لائحة السلوك أو لجنة المراجعة الأكاديمية وتقييم تحسن الطالب أسبوعياً.",
        phase: "إجرائي"
      },
      employment: {
        title: "التصعيد النظامي لمكتب العمل / التسوية الودية عند تعذر الحل",
        desc: "في حال انقضاء مهلة التظلم الداخلي دون تجاوب، ترفع مطالبة رسمية لحفظ الحقوق العمالية.",
        phase: "تصعيد نظامي"
      },
      government: {
        title: "تقديم تظلم إداري برقم القيد للجهة الرقابية الأعلى",
        desc: "إرفاق رقم الطلب وتاريخ تجاوز مدة الخدمة المعيارية للمطالبة بالبت النظامي.",
        phase: "تصعيد نظامي"
      },
      international: {
        title: "مخاطبة القنصلية / السفارة أو الجهة الدولية المختصة",
        desc: "تقديم ملف مكتمل بالوثائق الرسمية المترجمة ومتابعة الطلب عبر القنوات الدبلوماسية أو القانونية.",
        phase: "إجرائي دولي"
      },
      general: {
        title: "توثيق الاتفاق أو رفع بلاغ للجهة المختصة (حماية المستهلك / الجهات المعنية)",
        desc: "حفظ الفواتير والمحادثات والأدلة، وإتمام التسوية المكتوبة أو تصعيد البلاغ عبر المنصة الرسمية المختصة.",
        phase: "إجرائي عام"
      }
    };

    steps.push(sectorStepMap[sector] || sectorStepMap.general);

    return {
      id: "custom_" + Date.now(),
      isCustom: true,
      title: title,
      urgency: urgency,
      summary: details
        ? `${details} — (${stageLabels[stage]}، والهدف: ${goalLabels[goal]}).`
        : `تشخيص ذكي مخصص: ${stageLabels[stage]}، مع التركيز على ${goalLabels[goal]}.`,
      rootCauses: [
        stageLabels[stage],
        `الحاجة إلى ${goalLabels[goal]}`,
        ...(nlpMatchedSub ? [nlpMatchedSub.rootCauses[0]] : ["غياب آلية واضحة وموثقة لحسم الخلاف حتى الآن"])
      ],
      steps: steps,
      warnings: nlpMatchedSub
        ? nlpMatchedSub.warnings
        : [
            "تجنب ردود الفعل الانفعالية أو التهديد غير المدعوم بمستندات نظامية.",
            "لا تكتفِ بالوعود الشفهية في القضايا التي يترتب عليها حقوق أو مهل زمنية."
          ],
      legalOrOfficialNote:
        nlpMatchedSub?.legalOrOfficialNote ||
        "يمكنك الآن تحويل هذه الخطة مباشرة إلى مهام في (لوحة المتابعة) أو توليد خطاب رسمي جاهز للطباعة من قسم (النماذج والخطابات)."
    };
  }

  // ==================== 6. مولّد النماذج والخطابات الرسمية بالذكاء الاصطناعي ====================
  function initTemplatesEngine() {
    const selectEl = document.getElementById("templateSelect");
    selectEl.innerHTML = "";

    APP_DATA.templates.forEach((tpl) => {
      const opt = document.createElement("option");
      opt.value = tpl.id;
      opt.textContent = `${tpl.title} (${tpl.badge})`;
      selectEl.appendChild(opt);
    });

    selectEl.addEventListener("change", updateLetterPreview);

    const inputs = [
      "tplRecipient",
      "tplApplicant",
      "tplIdNumber",
      "tplRefNumber",
      "tplDateSubmitted",
      "tplPhone",
      "tplDetails"
    ];
    inputs.forEach((id) => {
      document.getElementById(id).addEventListener("input", updateLetterPreview);
    });

    // زر تحسين وصياغة الخطاب بالذكاء الاصطناعي
    const aiEnhanceBtn = document.getElementById("aiEnhanceLetterBtn");
    if (aiEnhanceBtn) {
      aiEnhanceBtn.addEventListener("click", () => {
        const detailsEl = document.getElementById("tplDetails");
        const rawText = detailsEl.value.trim();
        const selectedId = document.getElementById("templateSelect").value;
        const tpl = APP_DATA.templates.find((t) => t.id === selectedId) || APP_DATA.templates[0];

        const enhancedMap = {
          government: `أفيد سعادتكم بأنني تقدمت بالمعاملة المشار إليها أعلاه مستوفيةً لكافة المتطلبات والمستندات النظامية، إلا أنه قد انقضت المدة المعيارية المحددة لإنجاز الخدمة دون البت فيها.${rawText ? "\nوتتمثل التفاصيل في: " + rawText : ""}\nلذا أرجو التكرم بالتوجيه العاجل لإنجاز المعاملة وفق الأنظمة والتعليمات.`,
          employment: `أود إحاطتكم علماً بوقوع إخلال بالالتزامات التعاقدية المبرمة بيننا وفق عقد العمل ونظام العمل الساري، والمتمثل في: ${rawText || "تأخر صرف المستحقات المالية الشهرية وعدم تسوية الوضع الوظيفي"}.\nلذا آمل من إدارتكم الموقرة التكرم بمعالجة التظلم وصرف المستحقات النظامية خلال المهلة المحددة.`,
          school: `حرصاً منا على سلامة البيئة التربوية والتحصيل الدراسي للطالب المذكور، نحيطكم علماً بـ: ${rawText || "تعرض الطالب لمضايقات متكررة داخل المدرسة أثرت على استقراره النفسي والدراسي"}.\nنرجو التوجيه للجنة التوجيه والإرشاد باتخاذ الإجراءات التربوية والنظامية المعتمدة.`,
          family: `تم الاتفاق بين الطرفين بروح المودة والمسؤولية الأسرية المشتركة على تنظيم الشؤون التالية:\n${rawText || "1- الالتزام بالحوار الهادئ والاحترام المتبادل.\n2- تنظيم الميزانية والالتزامات الأسرية بوضوح تام.\n3- معالجة أي تباين في وجهات النظر بالحوار المباشر دون تدخل أطراف خارجية."}`,
          international: `أحيطكم علماً بتعرضي للواقعة/الطلب الموضح أعلاه، حيث تتلخص التفاصيل في: ${rawText || "طلب إعادة النظر في قرار التأشيرة / المطالبة بالمستحقات والتعويض النظامي وفق الاتفاقيات الدولية المعتمدة"}، وقد أرفقت كافة المسوغات الرسمية المؤيدة لطلبي.`,
          general: `أتقدم إليكم بهذه الشكوى الرسمية بخصوص: ${rawText || "وجود عيب مصنعي في المنتج/الخدمة المقدمة وامتناع الفرع عن تطبيق سياسة الضمان والاستبدال النظامية"}، وأطالب بمعالجة الضرر واسترداد الحق النظامي وفق أنظمة حماية المستهلك.`
        };

        detailsEl.value = enhancedMap[tpl.category] || enhancedMap.general;
        updateLetterPreview();
        showToast("✨ تم تحسين وصياغة متن الخطاب بأسلوب رسمي رصين بالذكاء الاصطناعي!");
      });
    }

    document.getElementById("copyLetterBtn").addEventListener("click", () => {
      const text = document.getElementById("letterPaper").innerText;
      navigator.clipboard.writeText(text).then(() => {
        showToast("تم نسخ نص الخطاب الرسمي إلى الحافظة!");
      });
    });

    document.getElementById("printLetterBtn").addEventListener("click", () => {
      window.print();
    });

    updateLetterPreview();
  }

  function updateLetterPreview() {
    const selectedId = document.getElementById("templateSelect").value;
    const tpl = APP_DATA.templates.find((t) => t.id === selectedId) || APP_DATA.templates[0];

    const formData = {
      recipient: document.getElementById("tplRecipient").value.trim(),
      applicantName: document.getElementById("tplApplicant").value.trim(),
      idNumber: document.getElementById("tplIdNumber").value.trim(),
      refNumber: document.getElementById("tplRefNumber").value.trim(),
      dateSubmitted: document.getElementById("tplDateSubmitted").value.trim(),
      phone: document.getElementById("tplPhone").value.trim(),
      details: document.getElementById("tplDetails").value.trim()
    };

    document.getElementById("letterBadge").textContent = tpl.badge;
    document.getElementById("letterPaper").textContent = tpl.generate(formData);
  }

  // ==================== 7. محاكي المفاوضات وحل النزاعات ====================
  function initNegotiationSimulator() {
    const selector = document.getElementById("scenarioSelector");
    selector.innerHTML = "";

    APP_DATA.negotiations.forEach((scen) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `scenario-btn ${scen.id === activeScenario.id ? "active" : ""}`;
      btn.innerHTML = `<i class="fa-solid fa-comments"></i> ${scen.title}`;
      btn.addEventListener("click", () => {
        activeScenario = scen;
        startScenario(scen);
        document.querySelectorAll(".scenario-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
      selector.appendChild(btn);
    });

    startScenario(activeScenario);
  }

  function startScenario(scenario) {
    simStepIndex = 0;
    simTrustScore = scenario.initialTrust;
    document.getElementById("simTitle").textContent = scenario.title;
    document.getElementById("simOpponent").innerHTML = `<i class="fa-solid fa-user-tie"></i> الطرف المقابل: ${scenario.opponentRole}`;
    updateTrustMeter(simTrustScore);

    const phrasesList = document.getElementById("goldenPhrasesList");
    phrasesList.innerHTML = scenario.goldenPhrases.map((p) => `<li>${p}</li>`).join("");

    const chatHistory = document.getElementById("simChatHistory");
    chatHistory.innerHTML = "";

    renderCurrentSimStep();
  }

  function renderCurrentSimStep() {
    const chatHistory = document.getElementById("simChatHistory");
    const optionsArea = document.getElementById("simOptionsArea");
    optionsArea.innerHTML = "";

    if (simStepIndex >= activeScenario.steps.length) {
      const resultMsg =
        simTrustScore >= 75
          ? "نتيجة ممتازة! أدرْتَ الحوار بذكاء وحزم دبلوماسي وحققت هدفك دون خسارة موقفك."
          : simTrustScore >= 50
          ? "نتيجة متوسطة. يمكنك تحسين النتيجة عبر اختيار الردود التي تجمع بين التوثيق والتركيز على الحل المشترك."
          : "انتهى الحوار بتوتر عالٍ أو تنازل عن حقك. جرب إعادة المحاكاة واختيار الردود الدبلوماسية الحازمة.";

      const summaryDiv = document.createElement("div");
      summaryDiv.className = "chat-feedback";
      summaryDiv.innerHTML = `<strong><i class="fa-solid fa-flag-checkered"></i> التقييم النهائي للمفاوضة (${simTrustScore}%):</strong> ${resultMsg}`;
      chatHistory.appendChild(summaryDiv);
      chatHistory.scrollTop = chatHistory.scrollHeight;

      const restartBtn = document.createElement("button");
      restartBtn.type = "button";
      restartBtn.className = "btn btn-primary";
      restartBtn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> إعادة تجربة السيناريو`;
      restartBtn.addEventListener("click", () => startScenario(activeScenario));
      optionsArea.appendChild(restartBtn);
      return;
    }

    const currentStep = activeScenario.steps[simStepIndex];

    const oppBubble = document.createElement("div");
    oppBubble.className = "chat-bubble chat-opponent";
    oppBubble.innerHTML = `<strong>الطرف المقابل:</strong><br>${currentStep.opponentText}`;
    chatHistory.appendChild(oppBubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    currentStep.options.forEach((opt) => {
      const optBtn = document.createElement("button");
      optBtn.type = "button";
      optBtn.className = "sim-option-btn";
      optBtn.innerHTML = `<i class="fa-regular fa-comment-dots"></i> ${opt.text}`;
      optBtn.addEventListener("click", () => handleSimOptionChoice(opt));
      optionsArea.appendChild(optBtn);
    });
  }

  function handleSimOptionChoice(option) {
    const chatHistory = document.getElementById("simChatHistory");

    const userBubble = document.createElement("div");
    userBubble.className = "chat-bubble chat-user";
    userBubble.innerHTML = `<strong>ردك:</strong><br>${option.text}`;
    chatHistory.appendChild(userBubble);

    simTrustScore = Math.max(5, Math.min(100, simTrustScore + option.scoreDelta));
    updateTrustMeter(simTrustScore);

    const feedbackEl = document.createElement("div");
    feedbackEl.className = "chat-feedback";
    const deltaSign = option.scoreDelta > 0 ? `+${option.scoreDelta}%` : `${option.scoreDelta}%`;
    feedbackEl.innerHTML = `<strong>تحليل الذكاء الاصطناعي (${deltaSign}):</strong> ${option.feedback}`;
    chatHistory.appendChild(feedbackEl);

    simStepIndex++;
    renderCurrentSimStep();
  }

  function updateTrustMeter(score) {
    document.getElementById("trustScoreText").textContent = `${score}%`;
    const fill = document.getElementById("trustBarFill");
    fill.style.width = `${score}%`;
    if (score >= 70) {
      fill.style.background = "linear-gradient(90deg, #10b981, #059669)";
    } else if (score >= 45) {
      fill.style.background = "linear-gradient(90deg, #3b82f6, #0ea5e9)";
    } else {
      fill.style.background = "linear-gradient(90deg, #f59e0b, #ef4444)";
    }
  }

  // ==================== 8. لوحة متابعة القضايا والمشكلات ====================
  function loadCasesFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }
    return JSON.parse(JSON.stringify(APP_DATA.defaultCases));
  }

  function saveCasesToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCases));
    } catch (e) {
      console.error(e);
    }
  }

  function initCaseTracker() {
    const openBtn = document.getElementById("openNewCaseModalBtn");
    const cancelBtn = document.getElementById("cancelNewCaseBtn");
    const panel = document.getElementById("newCasePanel");
    const form = document.getElementById("newCaseForm");

    openBtn.addEventListener("click", () => {
      panel.classList.toggle("hidden");
    });

    cancelBtn.addEventListener("click", () => {
      panel.classList.add("hidden");
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = document.getElementById("caseTitleInput").value.trim();
      const categoryId = document.getElementById("caseCategoryInput").value;
      const urgency = document.getElementById("caseUrgencyInput").value;
      const rawTasks = document.getElementById("caseTasksInput").value.trim();
      const notes = document.getElementById("caseNotesInput").value.trim();

      const catObj = APP_DATA.categories.find((c) => c.id === categoryId);
      const tasks = rawTasks
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ text, done: false }));

      const newCase = {
        id: "case_" + Date.now(),
        title,
        category: categoryId,
        categoryName: catObj ? catObj.name : "عام",
        urgency,
        createdAt: new Date().toISOString().slice(0, 10),
        status: "in_progress",
        tasks: tasks.length ? tasks : [{ text: "بدء خطوات المعالجة", done: false }],
        notes: notes || "لا توجد ملاحظات إضافية."
      };

      savedCases.unshift(newCase);
      saveCasesToStorage();
      renderCasesTracker();
      form.reset();
      panel.classList.add("hidden");
      showToast("تم تسجيل المشكلة في لوحة المتابعة بنجاح!");
    });

    renderCasesTracker();
  }

  function renderCasesTracker() {
    const badge = document.getElementById("trackerBadge");
    badge.textContent = savedCases.length;

    const totalCases = savedCases.length;
    let completedCases = 0;
    let totalTasks = 0;
    let doneTasks = 0;

    savedCases.forEach((c) => {
      const cTotal = c.tasks.length;
      const cDone = c.tasks.filter((t) => t.done).length;
      totalTasks += cTotal;
      doneTasks += cDone;
      if (cTotal > 0 && cDone === cTotal) completedCases++;
    });

    const overallRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    document.getElementById("trackerStatsRow").innerHTML = `
      <div class="tracker-stat-card">
        <span>إجمالي القضايا المتابعة</span>
        <strong>${totalCases}</strong>
      </div>
      <div class="tracker-stat-card">
        <span>قضايا مكتملة الحل</span>
        <strong style="color:var(--success)">${completedCases}</strong>
      </div>
      <div class="tracker-stat-card">
        <span>الخطوات المنجزة</span>
        <strong>${doneTasks} / ${totalTasks}</strong>
      </div>
      <div class="tracker-stat-card">
        <span>نسبة الإنجاز الكلية</span>
        <strong>${overallRate}%</strong>
      </div>
    `;

    const grid = document.getElementById("casesGrid");
    grid.innerHTML = "";

    if (savedCases.length === 0) {
      grid.innerHTML = `
        <div class="card" style="text-align:center; padding:40px;">
          <h4>لا توجد مشكلات محفوظة في لوحة المتابعة حالياً</h4>
          <p class="card-desc">يمكنك إضافة أي خطة حل من تبويب (المستشار والتشخيص) أو من (محادثة الذكاء الاصطناعي).</p>
        </div>
      `;
      return;
    }

    savedCases.forEach((caseItem) => {
      const total = caseItem.tasks.length;
      const done = caseItem.tasks.filter((t) => t.done).length;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;

      const urgencyClass =
        caseItem.urgency === "عالية"
          ? "badge-high"
          : caseItem.urgency === "متوسطة"
          ? "badge-medium"
          : "badge-low";

      const card = document.createElement("div");
      card.className = "card case-card";

      const tasksHtml = caseItem.tasks
        .map(
          (t, idx) => `
          <label class="task-row ${t.done ? "completed" : ""}">
            <input type="checkbox" data-case-id="${caseItem.id}" data-task-idx="${idx}" ${t.done ? "checked" : ""} />
            <span>${t.text}</span>
          </label>
        `
        )
        .join("");

      card.innerHTML = `
        <div>
          <div class="case-top">
            <div>
              <span class="badge badge-primary">${caseItem.categoryName}</span>
              <span class="badge ${urgencyClass}">الأولوية: ${caseItem.urgency}</span>
              <h4 class="case-title">${caseItem.title}</h4>
            </div>
            <button class="delete-case-btn" data-delete-id="${caseItem.id}" title="حذف من المتابعة">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>

          <div class="progress-wrap">
            <div class="progress-header">
              <span>تقدم خطوات الحل (${done} من ${total})</span>
              <strong>${percent}%</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width:${percent}%"></div>
            </div>
          </div>

          <div class="case-checklist">${tasksHtml}</div>
        </div>

        <div class="case-notes-box">
          <strong><i class="fa-regular fa-note-sticky"></i> ملاحظات المتابعة:</strong> ${caseItem.notes}
        </div>
      `;

      grid.appendChild(card);
    });

    grid.querySelectorAll('input[type="checkbox"]').forEach((chk) => {
      chk.addEventListener("change", () => {
        const cId = chk.getAttribute("data-case-id");
        const tIdx = parseInt(chk.getAttribute("data-task-idx"), 10);
        const targetCase = savedCases.find((c) => c.id === cId);
        if (targetCase && targetCase.tasks[tIdx]) {
          targetCase.tasks[tIdx].done = chk.checked;
          saveCasesToStorage();
          renderCasesTracker();
        }
      });
    });

    grid.querySelectorAll(".delete-case-btn").forEach((delBtn) => {
      delBtn.addEventListener("click", () => {
        const cId = delBtn.getAttribute("data-delete-id");
        savedCases = savedCases.filter((c) => c.id !== cId);
        saveCasesToStorage();
        renderCasesTracker();
        showToast("تم حذف القضية من لوحة المتابعة");
      });
    });
  }

  // ==================== 9. نظام الاشتراكات والباقات والدفع ====================
  function loadSubscriptionFromStorage() {
    try {
      const raw = localStorage.getItem(SUB_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }
    return {
      planId: "free",
      billing: "monthly",
      activatedAt: new Date().toISOString().slice(0, 10)
    };
  }

  function saveSubscriptionToStorage() {
    try {
      localStorage.setItem(SUB_STORAGE_KEY, JSON.stringify(userSubscription));
    } catch (e) {
      console.error(e);
    }
  }

  function formatPrice(sarAmount) {
    const curr = APP_DATA.currencies[activeCurrency] || APP_DATA.currencies.SAR;
    if (sarAmount === 0) return { amount: "مجاني", symbol: "" };
    const converted = Math.round(sarAmount * curr.rate);
    return { amount: converted.toLocaleString("ar-EG"), symbol: curr.symbol, rawConverted: converted };
  }

  function initSubscriptionsEngine() {
    const headerPlanBtn = document.getElementById("currentPlanBadgeBtn");
    const shareAppBtn = document.getElementById("shareAppBtn");
    const billMonthlyBtn = document.getElementById("billMonthlyBtn");
    const billYearlyBtn = document.getElementById("billYearlyBtn");
    const currencySelect = document.getElementById("currencySelect");

    if (shareAppBtn) {
      shareAppBtn.addEventListener("click", async () => {
        const shareData = {
          title: "منصة حُلُول AI | المستشار الذكي الشامل لحل المشكلات",
          text: "جرّب منصة حُلُول AI لحل المشاكل العائلية والمدرسية والتوظيفية والحكومية والدولية والعامة بالذكاء الاصطناعي:",
          url: window.location.href
        };
        if (navigator.share && window.location.protocol.startsWith("http")) {
          try {
            await navigator.share(shareData);
          } catch (e) {}
        } else {
          navigator.clipboard.writeText(window.location.href).then(() => {
            showToast("🌍 تم نسخ رابط المنصة لمشاركته مع العالم!");
          });
        }
      });
    }

    if (headerPlanBtn) {
      headerPlanBtn.addEventListener("click", () => {
        switchToTab("subscriptions");
      });
    }

    billMonthlyBtn.addEventListener("click", () => {
      billingPeriod = "monthly";
      billMonthlyBtn.classList.add("active");
      billYearlyBtn.classList.remove("active");
      renderSubscriptionsView();
    });

    billYearlyBtn.addEventListener("click", () => {
      billingPeriod = "yearly";
      billYearlyBtn.classList.add("active");
      billMonthlyBtn.classList.remove("active");
      renderSubscriptionsView();
    });

    currencySelect.addEventListener("change", () => {
      activeCurrency = currencySelect.value;
      renderSubscriptionsView();
    });

    initCheckoutModalEvents();
    renderSubscriptionsView();
  }

  function renderSubscriptionsView() {
    const plans = APP_DATA.subscriptionPlans || [];
    const currentPlanObj = plans.find((p) => p.id === userSubscription.planId) || plans[0];

    // تحديث الشارة العلوية في الهيدر
    const headerTextEl = document.getElementById("currentPlanHeaderText");
    if (headerTextEl && currentPlanObj) {
      headerTextEl.textContent = `الباقة: ${currentPlanObj.name}`;
    }

    // تحديث شريط حالة الاشتراك الحالي
    const bannerEl = document.getElementById("activeSubscriptionBanner");
    if (bannerEl && currentPlanObj) {
      const billingLabel = currentPlanObj.isDiamond
        ? "لمدة 900 سنة كاملة 💎"
        : currentPlanObj.isGold
        ? "لمدة 800 سنة كاملة 🥇"
        : currentPlanObj.isSilver
        ? "لمدة 700 سنة كاملة 🥈"
        : userSubscription.billing === "yearly"
        ? "سنوي"
        : "شهري";
      bannerEl.innerHTML = `
        <div>
          <span class="badge badge-primary"><i class="fa-solid ${currentPlanObj.icon}"></i> اشتراكك الحالي</span>
          <h4 style="margin-top:6px;">أنت مشترك حالياً في: <strong>${currentPlanObj.name}</strong> ${
            currentPlanObj.id !== "free" ? `(${billingLabel})` : ""
          }</h4>
          <p class="card-desc">تاريخ التفعيل: ${userSubscription.activatedAt} — ${currentPlanObj.tagline}</p>
        </div>
        <div>
          ${
            currentPlanObj.id === "free"
              ? `<span class="badge badge-medium"><i class="fa-solid fa-arrow-up-right-dots"></i> رقِّ باقتك الآن للحصول على استشارات AI وخطابات غير محدودة</span>`
              : `<button type="button" id="downgradeToFreeBtn" class="btn btn-outline btn-sm">إلغاء التجديد / العودة للمجانية</button>`
          }
        </div>
      `;

      const downgradeBtn = document.getElementById("downgradeToFreeBtn");
      if (downgradeBtn) {
        downgradeBtn.addEventListener("click", () => {
          userSubscription = {
            planId: "free",
            billing: "monthly",
            activatedAt: new Date().toISOString().slice(0, 10)
          };
          saveSubscriptionToStorage();
          renderSubscriptionsView();
          showToast("تم تغيير اشتراكك إلى الباقة الأساسية المجانية");
        });
      }
    }

    // رسم بطاقات الباقات
    const grid = document.getElementById("pricingGrid");
    if (!grid) return;
    grid.innerHTML = "";

    plans.forEach((plan) => {
      const isCurrent = plan.id === userSubscription.planId;
      const basePriceSAR = plan.isFixedMultiYear
        ? plan.fixedPriceSAR
        : billingPeriod === "yearly"
        ? plan.yearlyPriceSAR
        : plan.monthlyPriceSAR;
      const formatted = formatPrice(basePriceSAR);
      const periodText = plan.customPeriodLabel
        ? plan.customPeriodLabel
        : plan.monthlyPriceSAR === 0
        ? "مدى الحياة بدون بطاقة بنكية"
        : billingPeriod === "yearly"
        ? "/ سنوياً (شامل خصم 25%)"
        : "/ شهرياً (تجدد تلقائياً)";

      const featuresHtml = plan.features
        .map((f) => `<li><i class="fa-solid fa-circle-check"></i> <span>${f}</span></li>`)
        .join("");

      const card = document.createElement("div");
      card.className = `pricing-card ${plan.popular ? "popular" : ""} ${plan.isDiamond ? "diamond-card" : ""} ${
        plan.isGold ? "gold-card" : ""
      } ${plan.isSilver ? "silver-card" : ""} ${isCurrent ? "current-plan" : ""}`;

      const ribbonClass = plan.isDiamond
        ? "diamond-ribbon"
        : plan.isGold
        ? "gold-ribbon"
        : plan.isSilver
        ? "silver-ribbon"
        : "";

      card.innerHTML = `
        ${
          plan.popular
            ? `<div class="plan-popular-ribbon ${ribbonClass}">${plan.badge}</div>`
            : ""
        }
        <div>
          <div class="plan-header">
            <div class="plan-icon-badge" style="background:${plan.color}20; color:${plan.color}">
              <i class="fa-solid ${plan.icon}"></i>
            </div>
            <h3>${plan.name}</h3>
            <p class="plan-tagline">${plan.tagline}</p>
          </div>

          <div class="plan-price-box">
            <span class="plan-price-amount">${formatted.amount}</span>
            <span class="plan-price-currency">${formatted.symbol}</span>
            <div class="plan-price-period">${periodText}</div>
          </div>

          <ul class="plan-features-list">${featuresHtml}</ul>
        </div>

        <div>
          ${
            isCurrent
              ? `<button type="button" class="btn btn-success btn-block" disabled>
                   <i class="fa-solid fa-check-double"></i> الباقة المفعّلة حالياً
                 </button>`
              : `<button type="button" class="btn ${plan.popular ? "btn-primary" : "btn-outline"} btn-block select-plan-btn" data-plan-id="${plan.id}">
                   <i class="fa-solid ${
                     plan.isDiamond ? "fa-gem" : plan.isGold ? "fa-medal" : plan.isSilver ? "fa-award" : "fa-bolt"
                   }"></i> ${
                  plan.monthlyPriceSAR === 0
                    ? "التحويل للباقة المجانية"
                    : plan.isDiamond
                    ? "تفعيل الاشتراك الألماسي (900 سنة)"
                    : plan.isGold
                    ? "تفعيل الاشتراك الذهبي (800 سنة)"
                    : plan.isSilver
                    ? "تفعيل الاشتراك الفضي (700 سنة)"
                    : "اشترك الآن وفعّل الباقة"
                }
                 </button>`
          }
        </div>
      `;

      grid.appendChild(card);
    });

    grid.querySelectorAll(".select-plan-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const chosenId = btn.getAttribute("data-plan-id");
        handlePlanSelectionById(chosenId);
      });
    });

    document.querySelectorAll(".table-sub-btn").forEach((btn) => {
      btn.onclick = () => {
        const chosenId = btn.getAttribute("data-plan-id");
        handlePlanSelectionById(chosenId);
      };
    });

    function handlePlanSelectionById(chosenId) {
      const chosenPlan = plans.find((p) => p.id === chosenId);
      if (!chosenPlan) return;

      if (chosenPlan.monthlyPriceSAR === 0) {
        userSubscription = {
          planId: "free",
          billing: "monthly",
          activatedAt: new Date().toISOString().slice(0, 10)
        };
        saveSubscriptionToStorage();
        renderSubscriptionsView();
        showToast("تم تفعيل الباقة الأساسية المجانية");
      } else {
        openCheckoutModal(chosenPlan);
      }
    }
  }

  function openCheckoutModal(plan) {
    selectedPlanForCheckout = plan;
    appliedPromoDiscount = 0;

    const modal = document.getElementById("subscriptionCheckoutModal");
    const promoInput = document.getElementById("promoCodeInput");
    const promoFeedback = document.getElementById("promoFeedbackText");

    promoInput.value = "";
    promoFeedback.classList.add("hidden");

    updateCheckoutModalTotals();
    modal.classList.remove("hidden");
  }

  function updateCheckoutModalTotals() {
    if (!selectedPlanForCheckout) return;
    const baseSAR = selectedPlanForCheckout.isFixedMultiYear
      ? selectedPlanForCheckout.fixedPriceSAR
      : billingPeriod === "yearly"
      ? selectedPlanForCheckout.yearlyPriceSAR
      : selectedPlanForCheckout.monthlyPriceSAR;
    const discountedSAR = Math.round(baseSAR * (1 - appliedPromoDiscount));
    const formatted = formatPrice(discountedSAR);
    const periodLabel = selectedPlanForCheckout.isDiamond
      ? "اشتراك ألماسي لمدة 900 سنة كاملة 💎"
      : selectedPlanForCheckout.isGold
      ? "اشتراك ذهبي لمدة 800 سنة كاملة 🥇"
      : selectedPlanForCheckout.isSilver
      ? "اشتراك فضي لمدة 700 سنة كاملة 🥈"
      : billingPeriod === "yearly"
      ? "اشتراك سنوي (خصم 25%)"
      : "اشتراك شهري";

    document.getElementById("checkoutPlanSummary").innerHTML = `
      <div>
        <strong>${selectedPlanForCheckout.name}</strong>
        <div class="hint-text" style="font-size:0.82rem;">نوع الفوترة: ${periodLabel}</div>
      </div>
      <span class="badge badge-primary">${formatted.amount} ${formatted.symbol}</span>
    `;

    document.getElementById("checkoutFinalAmount").textContent = `${formatted.amount} ${formatted.symbol}`;
  }

  function initCheckoutModalEvents() {
    const modal = document.getElementById("subscriptionCheckoutModal");
    const closeBtn = document.getElementById("closeCheckoutModalBtn");
    const applyPromoBtn = document.getElementById("applyPromoBtn");
    const promoInput = document.getElementById("promoCodeInput");
    const promoFeedback = document.getElementById("promoFeedbackText");
    const payForm = document.getElementById("checkoutPaymentForm");
    const cardFieldsBox = document.getElementById("cardFieldsBox");

    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));

    // تطبيق كود الخصم
    applyPromoBtn.addEventListener("click", () => {
      const code = promoInput.value.trim().toUpperCase();
      if (["HULOOL50", "OMAR2026", "VIP50"].includes(code)) {
        appliedPromoDiscount = 0.5;
        promoFeedback.textContent = "🎉 تم تطبيق كود الخصم بنجاح! حصلت على خصم إضافي 50%.";
        promoFeedback.style.color = "var(--success)";
        promoFeedback.classList.remove("hidden");
        updateCheckoutModalTotals();
      } else {
        appliedPromoDiscount = 0;
        promoFeedback.textContent = "كود الخصم غير صالح؛ جرّب الكود الترويجي: HULOOL50";
        promoFeedback.style.color = "var(--danger)";
        promoFeedback.classList.remove("hidden");
        updateCheckoutModalTotals();
      }
    });

    // تبديل وسائل الدفع
    document.querySelectorAll(".pay-method-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".pay-method-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const method = btn.getAttribute("data-method");
        if (method === "card") {
          cardFieldsBox.classList.remove("hidden");
        } else {
          cardFieldsBox.classList.add("hidden");
        }
      });
    });

    // تأكيد الاشتراك وتفعيل الباقة
    payForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!selectedPlanForCheckout) return;

      userSubscription = {
        planId: selectedPlanForCheckout.id,
        billing: billingPeriod,
        activatedAt: new Date().toISOString().slice(0, 10)
      };
      saveSubscriptionToStorage();
      renderSubscriptionsView();
      modal.classList.add("hidden");
      showToast(`🎉 مبارك! تم تفعيل (${selectedPlanForCheckout.name}) بنجاح على حسابك`);
    });
  }
});
