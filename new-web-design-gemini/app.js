// ==========================================================================
// Obsidian Aurora Interactivity Module
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  // Elements
  const htmlEl = document.documentElement;
  const globalThemeToggle = document.getElementById("globalThemeToggle");
  const themeMoonIcon = document.getElementById("themeMoonIcon");
  
  // Navigation
  const navLanding = document.getElementById("navLanding");
  const navApp = document.getElementById("navApp");
  const logoLink = document.getElementById("logoLink");
  const exploreAppBtn = document.getElementById("exploreAppBtn");
  
  const landingView = document.getElementById("landingView");
  const appWorkspaceView = document.getElementById("appWorkspaceView");
  
  // Workspace Rails & Panels
  const railBtns = {
    dashboard: document.getElementById("railDashboard"),
    invoices: document.getElementById("railInvoices"),
    review: document.getElementById("railReview"),
    reports: document.getElementById("railReports"),
    lists: document.getElementById("railLists"),
    budgets: document.getElementById("railBudgets"),
    household: document.getElementById("railHousehold"),
    settings: document.getElementById("railSettings"),
    admin: document.getElementById("railAdmin")
  };
  
  const panes = {
    dashboard: document.getElementById("paneDashboard"),
    invoices: document.getElementById("paneInvoices"),
    review: document.getElementById("paneReview"),
    reports: document.getElementById("paneReports"),
    lists: document.getElementById("paneLists"),
    budgets: document.getElementById("paneBudgets"),
    household: document.getElementById("paneHousehold"),
    settings: document.getElementById("paneSettings"),
    admin: document.getElementById("paneAdmin")
  };

  // Drawer
  const dashboardTableBody = document.querySelector("#dashboardTable tbody");
  const ledgerTableBody = document.querySelector("#ledgerTable tbody");
  const inspectionDrawer = document.getElementById("inspectionDrawer");
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  const drawerCloseBtn = document.getElementById("drawerCloseBtn");
  const drawerStoreTitle = document.getElementById("drawerStoreTitle");
  const drawerImage = document.getElementById("drawerImage");
  const drawerMetaDate = document.getElementById("drawerMetaDate");
  const drawerMetaConf = document.getElementById("drawerMetaConf");
  const drawerLinesContainer = document.getElementById("drawerLinesContainer");

  // Invoices Filter
  const filterBtns = document.querySelectorAll(".filter-chip-btn");

  // Search filter
  const appSearchInput = document.getElementById("appSearchInput");

  // Pricing Toggle
  const pricingMonthly = document.getElementById("pricingMonthly");
  const pricingAnnual = document.getElementById("pricingAnnual");
  const premiumPrice = document.getElementById("premiumPrice");
  const premiumPeriod = document.getElementById("premiumPeriod");

  // Interactive Upload Dropzone Simulator (Landing Page)
  const dropzoneWidget = document.getElementById("dropzoneWidget");
  const widgetProgressContainer = document.getElementById("widgetProgressContainer");
  const widgetProgressBar = document.getElementById("widgetProgressBar");
  const widgetScannerContainer = document.getElementById("widgetScannerContainer");
  const mockupItemsContainer = document.getElementById("mockupItemsContainer");
  const mockupTotal = document.getElementById("mockupTotal");
  const mockupStoreName = document.getElementById("mockupStoreName");
  const mockupStatus = document.getElementById("mockupStatus");
  const progressText = document.getElementById("progressText");

  // Dashboard Ingestion Overlay Elements
  const dashboardUploadZone = document.getElementById("dashboardUploadZone");
  const fullscreenUploadOverlay = document.getElementById("fullscreenUploadOverlay");
  const fullscreenProgressText = document.getElementById("fullscreenProgressText");
  const stepperStep1 = document.getElementById("stepperStep1");
  const stepperStep2 = document.getElementById("stepperStep2");
  const stepperStep3 = document.getElementById("stepperStep3");

  // Interactive Steps Timeline
  const stepItems = document.querySelectorAll(".step-item");
  const stepVisuals = {
    1: document.getElementById("stepVisual1"),
    2: document.getElementById("stepVisual2"),
    3: document.getElementById("stepVisual3")
  };

  // Review Form Confirmation
  const confirmReviewBtn = document.getElementById("confirmReviewBtn");
  const skipReviewBtn = document.getElementById("skipReviewBtn");
  const reviewMerchantInput = document.getElementById("reviewMerchant");
  const reviewLineInput = document.getElementById("reviewLine");
  const reviewTotalInput = document.getElementById("reviewTotal");
  const reviewTagsRow = document.getElementById("reviewTagsRow");
  const addTagBtn = document.getElementById("addTagBtn");
  const reviewReceiptImage = document.getElementById("reviewReceiptImage");

  // --------------------------------------------------------------------------
  // 1. Theme Toggle: Dark/Light Mode
  // --------------------------------------------------------------------------
  globalThemeToggle.addEventListener("click", () => {
    const currentTheme = htmlEl.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    htmlEl.setAttribute("data-theme", nextTheme);
    
    // Animate theme toggle icon rotation and swap icon SVG inner content
    if (nextTheme === "light") {
      themeMoonIcon.innerHTML = `<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.32 11.32l.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />`;
    } else {
      themeMoonIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />`;
    }
  });

  // --------------------------------------------------------------------------
  // 2. View Navigation (Landing vs App Workspace)
  // --------------------------------------------------------------------------
  function showView(viewName) {
    if (viewName === "landing") {
      landingView.style.display = "block";
      appWorkspaceView.style.display = "none";
      navLanding.classList.add("active");
      navApp.classList.remove("active");
    } else {
      landingView.style.display = "none";
      appWorkspaceView.style.display = "block";
      navLanding.classList.remove("active");
      navApp.classList.add("active");
    }
    // Scroll to top on transition
    window.scrollTo({ top: 0, behavior: "smooth" });
    closeDrawer();
  }

  navLanding.addEventListener("click", (e) => {
    e.preventDefault();
    showView("landing");
  });

  navApp.addEventListener("click", (e) => {
    e.preventDefault();
    showView("app");
  });

  logoLink.addEventListener("click", (e) => {
    e.preventDefault();
    showView("landing");
  });

  exploreAppBtn.addEventListener("click", () => {
    showView("app");
    switchWorkspacePane("dashboard");
  });

  // --------------------------------------------------------------------------
  // 3. Workspace Pane Switching (Dashboard, Invoices, Review, etc.)
  // --------------------------------------------------------------------------
  function switchWorkspacePane(paneKey) {
    // Update active class on rail buttons
    Object.keys(railBtns).forEach(key => {
      if (key === paneKey) {
        railBtns[key].classList.add("active");
      } else {
        railBtns[key].classList.remove("active");
      }
    });

    // Toggle panes display
    Object.keys(panes).forEach(key => {
      if (key === paneKey) {
        panes[key].classList.add("active");
      } else {
        panes[key].classList.remove("active");
      }
    });

    closeDrawer();
  }

  Object.keys(railBtns).forEach(key => {
    railBtns[key].addEventListener("click", () => {
      switchWorkspacePane(key);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Slide-out Inspection Drawer Logic & Data Store
  // --------------------------------------------------------------------------
  const mockInvoiceData = {
    1: {
      merchant: "Jumbo Oostpoort",
      date: "12 Jun 2026",
      confidence: "Processed",
      image: "../invoices/jumbo_1.jpeg",
      lines: [
        { name: "Organic Bananas 1kg", price: "€2.49" },
        { name: "Alpro Soy Milk 1L", price: "€1.89" },
        { name: "Jumbo Eggs Large x12", price: "€3.19" },
        { name: "Whole wheat sourdough bread", price: "€2.60" },
        { name: "Greek Yoghurt 5% Fat 1kg", price: "€3.89" },
        { name: "Pesto Genovese 190g", price: "€2.29" },
        { name: "Barilla Penne Rigate 500g", price: "€1.49" },
        { name: "Organic Tomatoes 500g", price: "€2.99" },
        { name: "Extra Virgin Olive Oil 750ml", price: "€7.90" }
      ]
    },
    2: {
      merchant: "AH To Go",
      date: "11 Jun 2026",
      confidence: "Needs Review",
      image: "../invoices/ah_to_go_1.jpeg",
      lines: [
        { name: "Latte Macchiato", price: "€3.95" },
        { name: "Croissant Butter", price: "€1.60" },
        { name: "Fresh Orange Juice 300ml", price: "€2.80" },
        { name: "Ham & Cheese Toastie", price: "€3.80" }
      ]
    },
    3: {
      merchant: "Tokomania",
      date: "09 Jun 2026",
      confidence: "Auto Parsed",
      image: "../invoices/tk_1.jpeg",
      lines: [
        { name: "Jasmine Rice 5kg", price: "€12.50" },
        { name: "Premium Soy Sauce 500ml", price: "€4.20" },
        { name: "Organic Tofu Block", price: "€1.80" },
        { name: "Fresh Ginger Root 200g", price: "€1.50" },
        { name: "Sriracha Hot Sauce 450ml", price: "€3.90" },
        { name: "Coconut Milk Cans x4", price: "€4.80" },
        { name: "Spicy Ramen Packs x5", price: "€5.50" }
      ]
    },
    4: {
      merchant: "Albert Heijn XL",
      date: "06 Jun 2026",
      confidence: "Processed",
      image: "../invoices/ah_1.jpeg",
      lines: [
        { name: "Bulk Coffee Beans 1kg", price: "€18.90" },
        { name: "Organic Honey 500g", price: "€6.40" },
        { name: "Extra Stout Beer x6", price: "€10.50" },
        { name: "Parmigiano Reggiano 200g", price: "€5.80" },
        { name: "Free Range Chicken Breast 600g", price: "€9.20" }
      ]
    },
    5: {
      merchant: "Restaurante Cantinho",
      date: "12 Jun 2026",
      confidence: "Needs Review",
      image: "../invoices/ah_to_go_2.jpeg", // Placeholder for restaurant receipt
      lines: [
        { name: "Grilled Salmon Fillet", price: "€18.50" },
        { name: "Fresh Red Sangria 1L", price: "€16.00" },
        { name: "Cover Charge / Olives", price: "€3.00" },
        { name: "Service Tip (10%)", price: "€5.00" }
      ]
    }
  };

  function openDrawer(invoiceId) {
    const data = mockInvoiceData[invoiceId];
    if (!data) return;

    // Set drawer text details
    drawerStoreTitle.textContent = data.merchant;
    drawerImage.src = data.image;
    drawerMetaDate.textContent = data.date;
    drawerMetaConf.textContent = data.confidence;
    
    // Set confidence badge styling inside drawer
    if (data.confidence.includes("Needs")) {
      drawerMetaConf.className = "drawer-meta-value badge badge-warning";
    } else if (data.confidence.includes("Auto")) {
      drawerMetaConf.className = "drawer-meta-value badge badge-primary";
    } else {
      drawerMetaConf.className = "drawer-meta-value badge badge-success";
    }

    // Populate line items
    drawerLinesContainer.innerHTML = "";
    data.lines.forEach(line => {
      const row = document.createElement("div");
      row.className = "drawer-line-item";
      row.innerHTML = `
        <span class="drawer-line-name">${line.name}</span>
        <span class="drawer-line-price">${line.price}</span>
      `;
      drawerLinesContainer.appendChild(row);
    });

    // Slide in
    inspectionDrawer.classList.add("active");
    drawerBackdrop.classList.add("active");
  }

  function closeDrawer() {
    inspectionDrawer.classList.remove("active");
    drawerBackdrop.classList.remove("active");
  }

  // Row listeners setup
  function bindTableRows() {
    const tableRows = document.querySelectorAll(".app-table tbody tr");
    tableRows.forEach(row => {
      // Remove any existing click listener to avoid duplicate bindings
      const newRow = row.cloneNode(true);
      row.parentNode.replaceChild(newRow, row);
      
      newRow.addEventListener("click", () => {
        const invoiceId = newRow.dataset.invoiceId;
        if (invoiceId) openDrawer(invoiceId);
      });
    });
  }

  bindTableRows();

  drawerCloseBtn.addEventListener("click", closeDrawer);
  drawerBackdrop.addEventListener("click", closeDrawer);

  // --------------------------------------------------------------------------
  // 5. Invoices Filter List Toggle & Search
  // --------------------------------------------------------------------------
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      // Toggle button active
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const filterVal = btn.dataset.filter;
      const currentLedgerRows = document.querySelectorAll("#ledgerTable tbody tr");

      // Filter rows
      currentLedgerRows.forEach(row => {
        const rowStatus = row.dataset.status;
        if (filterVal === "all" || rowStatus === filterVal) {
          row.style.display = "table-row";
        } else {
          row.style.display = "none";
        }
      });
    });
  });

  // Simple keyup search table filter
  appSearchInput.addEventListener("keyup", () => {
    const query = appSearchInput.value.toLowerCase().trim();
    const currentLedgerRows = document.querySelectorAll("#ledgerTable tbody tr");
    
    // Switch to invoices list view when the user searches to give feedback
    if (appWorkspaceView.style.display === "block" && !panes.invoices.classList.contains("active") && query !== "") {
      switchWorkspacePane("invoices");
    }

    currentLedgerRows.forEach(row => {
      const text = row.innerText.toLowerCase();
      if (text.includes(query)) {
        row.style.display = "table-row";
      } else {
        row.style.display = "none";
      }
    });
  });

  // --------------------------------------------------------------------------
  // 6. Pricing Interval Switcher
  // --------------------------------------------------------------------------
  function setPricingInterval(interval) {
    if (interval === "annual") {
      pricingAnnual.classList.add("active");
      pricingMonthly.classList.remove("active");
      
      // Update Premium Pricing to €6.40 billed annually
      premiumPrice.textContent = "6.40";
      premiumPeriod.textContent = "/mo, billed annually";
      
      // Add subtle scale animation to highlight the savings
      premiumPrice.style.transform = "scale(1.1)";
      setTimeout(() => premiumPrice.style.transform = "scale(1)", 150);
    } else {
      pricingMonthly.classList.add("active");
      pricingAnnual.classList.remove("active");
      
      // Update Premium Pricing to €8 billed monthly
      premiumPrice.textContent = "8";
      premiumPeriod.textContent = "/mo";
    }
  }

  pricingMonthly.addEventListener("click", () => setPricingInterval("monthly"));
  pricingAnnual.addEventListener("click", () => setPricingInterval("annual"));

  // --------------------------------------------------------------------------
  // 7. Interactive Ingest Simulator Widget (Landing Page)
  // --------------------------------------------------------------------------
  let isUploading = false;
  
  dropzoneWidget.addEventListener("click", () => {
    if (isUploading) return;
    simulateUpload();
  });

  function simulateUpload() {
    isUploading = true;
    
    // Phase 1: Show Ingestion Progress Bar
    const dropzoneContent = dropzoneWidget.querySelectorAll("p, .upload-icon");
    dropzoneContent.forEach(el => el.style.opacity = "0.1");
    widgetProgressContainer.style.display = "block";
    widgetProgressBar.style.width = "0%";
    progressText.textContent = "Uploading receipt...";

    // Animate progress fill
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      widgetProgressBar.style.width = `${progress}%`;
      
      if (progress === 40) {
        progressText.textContent = "Adjusting contrast...";
      }
      if (progress === 80) {
        progressText.textContent = "Extracting products and prices...";
      }
      
      if (progress >= 100) {
        clearInterval(interval);
        
        // Phase 2: Start Scanner Beam Animation
        widgetProgressContainer.style.display = "none";
        widgetScannerContainer.style.display = "block";
        progressText.textContent = "Reading details...";

        // Set random image from invoices
        const images = ["../invoices/ah_to_go_1.jpeg", "../invoices/jumbo_1.jpeg", "../invoices/ah_1.jpeg"];
        const randomImg = images[Math.floor(Math.random() * images.length)];
        document.getElementById("scannerPreviewImage").src = randomImg;

        setTimeout(() => {
          // Phase 3: Complete scan, restore dropzone and insert mockup details
          isUploading = false;
          widgetScannerContainer.style.display = "none";
          dropzoneContent.forEach(el => el.style.opacity = "1");
          
          // Render mock parsed data (Lidl Lisbon)
          mockupStoreName.textContent = "Lidl — Lisbon Norte";
          mockupDate.textContent = "25 May 2026";
          mockupStatus.textContent = "PROCESSED";
          mockupStatus.className = "badge badge-success";
          
          mockupItemsContainer.innerHTML = `
            <div class="mockup-item" style="animation: fadeIn 0.4s ease forwards;">
              <span class="mockup-item-name">Organic Whole Milk 1L</span>
              <span class="mockup-item-price">€3.89</span>
            </div>
            <div class="mockup-item" style="animation: fadeIn 0.4s ease forwards 0.1s;">
              <span class="mockup-item-name">Free Range Eggs (12)</span>
              <span class="mockup-item-price">€4.25</span>
            </div>
            <div class="mockup-item" style="animation: fadeIn 0.4s ease forwards 0.2s;">
              <span class="mockup-item-name">Sourdough Bread 800g</span>
              <span class="mockup-item-price">€2.99</span>
            </div>
          `;
          
          mockupTotal.textContent = "€11.13";
          
          // Trigger subtle glow animation on complete
          const mockupCard = document.getElementById("landingUploadMockup");
          mockupCard.style.boxShadow = "0 0 30px 5px var(--brand-glow)";
          setTimeout(() => {
            mockupCard.style.boxShadow = "var(--card-shadow)";
          }, 1500);

        }, 2500);
      }
    }, 200);
  }

  // --------------------------------------------------------------------------
  // 8. Fullscreen Dashboard Ingestion Overlay (Invoice Comparator Style)
  // --------------------------------------------------------------------------
  dashboardUploadZone.addEventListener("click", () => {
    simulateDashboardUpload();
  });

  function simulateDashboardUpload() {
    // Show Fullscreen Overlay
    fullscreenUploadOverlay.classList.add("active");
    stepperStep1.className = "stepper-step active";
    stepperStep2.className = "stepper-step";
    stepperStep3.className = "stepper-step";
    fullscreenProgressText.textContent = "Compressing receipt image...";

    // Step 1: Upload (0.8 seconds)
    setTimeout(() => {
      stepperStep2.className = "stepper-step active";
      fullscreenProgressText.textContent = "Preparing secure upload & checking hashes...";
    }, 1200);

    // Step 2: Validate (2.0 seconds)
    setTimeout(() => {
      stepperStep3.className = "stepper-step active";
      fullscreenProgressText.textContent = "AI is reading receipt items and tip fields...";
    }, 2400); // 2400ms

    // Step 3: Complete Ingestion
    setTimeout(() => {
      // Hide Fullscreen Overlay
      fullscreenUploadOverlay.classList.remove("active");

      // 1. Dynamically add row to Dashboard Table
      const newDashboardRow = document.createElement("tr");
      newDashboardRow.dataset.invoiceId = "5";
      newDashboardRow.innerHTML = `
        <td>
          <div class="row-merchant-cell">
            <div class="merchant-icon-badge bg-cantinho">
              <i data-lucide="utensils-crossed"></i>
            </div>
            Restaurante Cantinho
          </div>
        </td>
        <td>12 Jun 2026</td>
        <td><span class="badge badge-warning">Needs Review</span></td>
        <td>
          <div class="tag-badge-row">
            <span class="table-tag">trip</span>
            <span class="table-tag">dinner</span>
          </div>
        </td>
        <td class="numeric-col">€42.50</td>
      `;
      // Insert on top of tbody
      dashboardTableBody.insertBefore(newDashboardRow, dashboardTableBody.firstChild);

      // 2. Dynamically add row to Ledger Table
      const newLedgerRow = document.createElement("tr");
      newLedgerRow.dataset.invoiceId = "5";
      newLedgerRow.dataset.status = "needs_review";
      newLedgerRow.innerHTML = `
        <td>
          <div class="row-merchant-cell">
            <div class="merchant-icon-badge bg-cantinho">
              <i data-lucide="utensils-crossed"></i>
            </div>
            Restaurante Cantinho
          </div>
        </td>
        <td>12 Jun 2026</td>
        <td><span class="badge badge-warning">Needs Review</span></td>
        <td>4 items</td>
        <td>
          <div class="tag-badge-row">
            <span class="table-tag">trip</span>
            <span class="table-tag">dinner</span>
          </div>
        </td>
        <td class="numeric-col">€42.50</td>
      `;
      ledgerTableBody.insertBefore(newLedgerRow, ledgerTableBody.firstChild);

      // Re-bind click event listeners to include new rows
      bindTableRows();

      // Render newly inserted Lucide icons
      if (window.lucide) window.lucide.createIcons();

      // 3. Swap review panel details to display "Restaurante Cantinho"
      reviewMerchantInput.value = "Restaurante Cantinho - Lisbon";
      reviewLineInput.value = "Red Sangria 1L";
      reviewTotalInput.value = "€42.50";
      reviewReceiptImage.src = "../invoices/ah_to_go_2.jpeg"; // Use as mockup restaurant receipt
      
      // Update review tags
      reviewTagsRow.innerHTML = `
        <span class="tag-chip">
          trip
          <button class="tag-chip-remove" onclick="removeTag(this)">&times;</button>
        </span>
        <span class="tag-chip">
          dinner
          <button class="tag-chip-remove" onclick="removeTag(this)">&times;</button>
        </span>
        <button class="tag-add-btn" id="addTagBtn">+</button>
      `;

      // Rebind tags add button listener
      const newAddTagBtn = document.getElementById("addTagBtn");
      newAddTagBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const tag = prompt("Enter a tag:");
        if (tag && tag.trim()) {
          const chip = document.createElement("span");
          chip.className = "tag-chip";
          chip.innerHTML = `${tag.toLowerCase().trim()} <button class="tag-chip-remove" onclick="removeTag(this)">&times;</button>`;
          reviewTagsRow.insertBefore(chip, newAddTagBtn);
        }
      });

      // Show toast notification & switch to Parse Review tab immediately
      alert("Receipt uploaded! Review verification is required for low confidence lines.");
      switchWorkspacePane("review");

    }, 3800);
  }

  // --------------------------------------------------------------------------
  // 9. Step-by-Step Interactive Timeline
  // --------------------------------------------------------------------------
  stepItems.forEach(item => {
    item.addEventListener("click", () => {
      // Toggle active states on items
      stepItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      // Swap visual content pane
      const stepNum = item.dataset.step;
      Object.keys(stepVisuals).forEach(key => {
        if (key === stepNum) {
          stepVisuals[key].classList.add("active");
        } else {
          stepVisuals[key].classList.remove("active");
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // 10. Interactive Ingest Verification Panel (Review View)
  // --------------------------------------------------------------------------
  confirmReviewBtn.addEventListener("click", () => {
    const originalBtnText = confirmReviewBtn.textContent;
    confirmReviewBtn.textContent = "Saving...";
    confirmReviewBtn.disabled = true;

    // Simulate saving
    setTimeout(() => {
      confirmReviewBtn.textContent = "Saved! ✓";
      confirmReviewBtn.style.backgroundColor = "var(--success)";
      
      // Update the badge in the mock review list
      const cantinhoDashboardRow = document.querySelector('#dashboardTable tr[data-invoice-id="5"] .badge');
      if (cantinhoDashboardRow) {
        cantinhoDashboardRow.textContent = "Processed";
        cantinhoDashboardRow.className = "badge badge-success";
      }
      const cantinhoLedgerRow = document.querySelector('#ledgerTable tr[data-invoice-id="5"] .badge');
      if (cantinhoLedgerRow) {
        cantinhoLedgerRow.textContent = "Processed";
        cantinhoLedgerRow.className = "badge badge-success";
        cantinhoLedgerRow.closest("tr").dataset.status = "confirmed";
      }

      // Also reset mock data value to "Processed"
      if (mockInvoiceData[5]) {
        mockInvoiceData[5].confidence = "Processed";
      }

      setTimeout(() => {
        // Reset state
        confirmReviewBtn.textContent = originalBtnText;
        confirmReviewBtn.style.backgroundColor = "";
        confirmReviewBtn.disabled = false;
        
        // Remove flagged warning borders
        const flaggedField = document.querySelector(".form-field--flagged");
        if (flaggedField) {
          flaggedField.classList.remove("form-field--flagged");
          const warningSign = flaggedField.querySelector(".field-warning-indicator");
          if (warningSign) warningSign.remove();
        }

        // Inform user and redirect to dashboard to see results
        alert("Receipt details updated successfully.");
        switchWorkspacePane("dashboard");
      }, 1000);

    }, 1200);
  });

  skipReviewBtn.addEventListener("click", () => {
    const confirmSkip = confirm("Skip check for this receipt?");
    if (confirmSkip) {
      switchWorkspacePane("dashboard");
    }
  });

  // Helper to remove tags dynamically
  window.removeTag = function(button) {
    const chip = button.closest(".tag-chip");
    if (chip) chip.remove();
  };

  // Add new mock tag composer (initial load)
  if (addTagBtn) {
    addTagBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const newTagName = prompt("Enter a tag:");
      if (newTagName && newTagName.trim() !== "") {
        const chip = document.createElement("span");
        chip.className = "tag-chip";
        chip.innerHTML = `
          ${newTagName.toLowerCase().trim()}
          <button class="tag-chip-remove" onclick="removeTag(this)">&times;</button>
        `;
        // Insert before the Add button
        reviewTagsRow.insertBefore(chip, addTagBtn);
      }
    });
  }

  // --------------------------------------------------------------------------
  // 11. Sandbox Controls (RLS Toggle & Reset Seed Data)
  // --------------------------------------------------------------------------
  let isRlsEnforced = true;
  const devToggleRls = document.getElementById("devToggleRls");
  const rlsShieldIcon = document.getElementById("rlsShieldIcon");
  const rlsStatusText = document.getElementById("rlsStatusText");
  const rlsViolationAlert = document.getElementById("rlsViolationAlert");
  const rlsViolationCloseBtn = document.getElementById("rlsViolationCloseBtn");
  const devResetSeeds = document.getElementById("devResetSeeds");

  if (devToggleRls) {
    devToggleRls.addEventListener("click", () => {
      isRlsEnforced = !isRlsEnforced;
      if (isRlsEnforced) {
        devToggleRls.classList.add("active");
        if (rlsStatusText) rlsStatusText.textContent = "RLS: Enforced";
        if (rlsShieldIcon) {
          rlsShieldIcon.style.color = "var(--success)";
          rlsShieldIcon.innerHTML = `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`;
        }
        if (rlsViolationAlert) rlsViolationAlert.style.display = "none";
        alert("PostgreSQL Row-Level Security Enforced.");
      } else {
        devToggleRls.classList.remove("active");
        if (rlsStatusText) rlsStatusText.textContent = "RLS: Bypassed";
        if (rlsShieldIcon) {
          rlsShieldIcon.style.color = "var(--danger)";
          rlsShieldIcon.innerHTML = `<path d="m10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>`; // Warning symbol path
        }
        if (rlsViolationAlert) rlsViolationAlert.style.display = "block";
        alert("PostgreSQL tenant separation bypass warning: Current query attempted accessing data from user ID usr_9a4f210e. Operation blocked by RLS policies.");
      }
    });
  }

  if (rlsViolationCloseBtn) {
    rlsViolationCloseBtn.addEventListener("click", () => {
      if (rlsViolationAlert) rlsViolationAlert.style.display = "none";
    });
  }

  if (devResetSeeds) {
    devResetSeeds.addEventListener("click", () => {
      // Reset shopping list
      currentShoppingList = JSON.parse(JSON.stringify(INITIAL_SHOPPING_LIST));
      renderShoppingChecklist();
      calculateStoreCosts();

      // Reset trends
      const trendsSearch = document.getElementById("trendsProductSearch");
      if (trendsSearch) trendsSearch.value = "Organic Whole Milk 1L";
      const trendsClear = document.getElementById("trendsSearchClearBtn");
      if (trendsClear) trendsClear.style.display = "none";
      
      const segmentBtns = document.querySelectorAll("#trendsPeriodControl .segment-btn");
      segmentBtns.forEach(btn => {
        if (btn.dataset.period === "90d") btn.classList.add("active");
        else btn.classList.remove("active");
      });

      const storeRows = document.querySelectorAll("#trendsStoreFilters .store-checkbox-row");
      storeRows.forEach(row => row.classList.add("active"));

      drawTrendsChart();

      // Reset RLS
      isRlsEnforced = true;
      if (devToggleRls) {
        devToggleRls.classList.add("active");
        if (rlsStatusText) rlsStatusText.textContent = "RLS: Enforced";
        if (rlsShieldIcon) {
          rlsShieldIcon.style.color = "var(--success)";
          rlsShieldIcon.innerHTML = `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`;
        }
      }
      if (rlsViolationAlert) rlsViolationAlert.style.display = "none";

      // Reset uploaded items (simulate removing Cantinho if added)
      const cantinhoDashboardRow = document.querySelector('#dashboardTable tr[data-invoice-id="5"]');
      if (cantinhoDashboardRow) cantinhoDashboardRow.remove();
      const cantinhoLedgerRow = document.querySelector('#ledgerTable tr[data-invoice-id="5"]');
      if (cantinhoLedgerRow) cantinhoLedgerRow.remove();
      
      if (mockInvoiceData[5]) delete mockInvoiceData[5];

      // Restore review form inputs
      reviewMerchantInput.value = "";
      reviewLineInput.value = "";
      reviewTotalInput.value = "";
      reviewReceiptImage.src = "../invoices/ah_to_go_2.jpeg";
      
      // Re-bind table rows click event
      bindTableRows();

      alert("Local sandbox seed datasets and configuration reset successfully!");
    });
  }

  // --------------------------------------------------------------------------
  // 12. Interactive Shopping List Builder & Route Optimizer
  // --------------------------------------------------------------------------
  const starterVocabulary = [
    "Organic Whole Milk 1L",
    "Organic Avocados",
    "Fairtrade Bananas",
    "Jasmine Rice 5kg",
    "Eggs 12-pack",
    "Sourdough Bread 800g",
    "Bulk Coffee Beans 1kg",
    "Premium Soy Sauce 500ml",
    "Red Sangria 1L"
  ];

  const storePrices = {
    "Organic Whole Milk 1L": { ah: 1.25, jumbo: 1.19, dirk: 1.09 },
    "Organic Avocados": { ah: 1.49, jumbo: 1.59, dirk: 1.29 },
    "Fairtrade Bananas": { ah: 1.99, jumbo: 1.89, dirk: 1.79 },
    "Jasmine Rice 5kg": { ah: 13.50, jumbo: 12.99, dirk: 12.50 },
    "Eggs 12-pack": { ah: 3.49, jumbo: 3.19, dirk: 2.99 },
    "Sourdough Bread 800g": { ah: 2.80, jumbo: 2.60, dirk: 2.45 },
    "Bulk Coffee Beans 1kg": { ah: 19.50, jumbo: 18.90, dirk: 17.99 },
    "Premium Soy Sauce 500ml": { ah: 4.50, jumbo: 4.20, dirk: 3.99 },
    "Red Sangria 1L": { ah: 5.50, jumbo: 4.99, dirk: 4.50 }
  };

  const listStores = [
    { key: "ah", name: "Albert Heijn XL", branch: "Oostpoort branch", color: "#00a1e2", textCol: "#ffffff", icon: "shopping-bag" },
    { key: "jumbo", name: "Jumbo Oostpoort", branch: "Oostpoort branch", color: "#f59e0b", textCol: "#0f172a", icon: "shopping-cart" },
    { key: "dirk", name: "Dirk van den Broek", branch: "Oostpoort branch", color: "#ef4444", textCol: "#ffffff", icon: "tag" }
  ];

  const INITIAL_SHOPPING_LIST = [
    { name: "Organic Whole Milk 1L", qty: 2, checked: false },
    { name: "Organic Avocados", qty: 3, checked: true },
    { name: "Sourdough Bread 800g", qty: 1, checked: false }
  ];

  let currentShoppingList = JSON.parse(JSON.stringify(INITIAL_SHOPPING_LIST));

  function renderShoppingChecklist() {
    const container = document.getElementById("shoppingChecklistContainer");
    const countBadge = document.getElementById("listItemsCountBadge");
    if (!container) return;
    container.innerHTML = "";
    
    if (countBadge) {
      countBadge.textContent = `${currentShoppingList.length} item${currentShoppingList.length === 1 ? "" : "s"}`;
    }

    if (currentShoppingList.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-secondary); font-size:13.5px;">
          Your shopping list is empty. Add products above to compare store prices.
        </div>
      `;
      return;
    }

    currentShoppingList.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = `checklist-item-card ${item.checked ? "checked" : ""}`;
      card.dataset.index = index;
      
      const checkIcon = item.checked ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : "";
      
      card.innerHTML = `
        <div class="checklist-left-side">
          <span class="checklist-checkbox">${checkIcon}</span>
          <span class="checklist-item-title">${item.name}</span>
        </div>
        <div class="checklist-right-side">
          <div class="quantity-stepper">
            <button class="stepper-btn stepper-dec">&minus;</button>
            <span class="stepper-value">${item.qty}</span>
            <button class="stepper-btn stepper-inc">+</button>
          </div>
          <button class="btn-icon-delete" title="Delete Item" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px; display:flex; align-items:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      `;
      
      const leftSide = card.querySelector(".checklist-left-side");
      leftSide.addEventListener("click", () => {
        item.checked = !item.checked;
        renderShoppingChecklist();
        calculateStoreCosts();
      });
      
      const decBtn = card.querySelector(".stepper-dec");
      decBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (item.qty > 1) {
          item.qty -= 1;
          renderShoppingChecklist();
          calculateStoreCosts();
        }
      });
      
      const incBtn = card.querySelector(".stepper-inc");
      incBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        item.qty += 1;
        renderShoppingChecklist();
        calculateStoreCosts();
      });
      
      const delBtn = card.querySelector(".btn-icon-delete");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        currentShoppingList.splice(index, 1);
        renderShoppingChecklist();
        calculateStoreCosts();
      });
      
      container.appendChild(card);
    });
  }

  function calculateStoreCosts() {
    const container = document.getElementById("storeComparisonCardsContainer");
    const savingsBanner = document.getElementById("listOptimizerSavingsBanner");
    const savingsAmount = document.getElementById("listOptimizerSavingsAmount");
    if (!container) return;
    container.innerHTML = "";

    if (currentShoppingList.length === 0) {
      if (savingsBanner) savingsBanner.style.display = "none";
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-secondary); font-size:13.5px;">
          Add items to your checklist to compare store basket costs.
        </div>
      `;
      return;
    }

    const results = listStores.map(store => {
      let total = 0;
      const itemsBreakdown = [];
      
      currentShoppingList.forEach(item => {
        const prices = storePrices[item.name];
        const unitPrice = prices ? prices[store.key] : 1.99;
        const cost = unitPrice * item.qty;
        total += cost;
        
        itemsBreakdown.push({
          name: item.name,
          qty: item.qty,
          cost: cost
        });
      });
      
      return {
        store: store,
        total: total,
        breakdown: itemsBreakdown
      };
    });

    // Sort by total cost ascending
    results.sort((a, b) => a.total - b.total);
    
    const cheapestTotal = results[0].total;
    const mostExpensiveTotal = results[results.length - 1].total;
    const difference = mostExpensiveTotal - cheapestTotal;
    
    if (savingsBanner && savingsAmount) {
      if (difference > 0 && currentShoppingList.length > 0) {
        savingsAmount.textContent = `€${difference.toFixed(2)}`;
        savingsBanner.style.display = "block";
      } else {
        savingsBanner.style.display = "none";
      }
    }

    results.forEach((res, idx) => {
      const store = res.store;
      const isCheapest = idx === 0;
      
      const card = document.createElement("div");
      card.className = `store-comp-card ${isCheapest ? "cheapest-store" : ""}`;
      
      let breakdownRows = "";
      res.breakdown.forEach(item => {
        breakdownRows += `
          <div class="breakdown-row">
            <span>${item.qty}x ${item.name}</span>
            <span style="font-variant-numeric: tabular-nums;">€${item.cost.toFixed(2)}</span>
          </div>
        `;
      });

      card.innerHTML = `
        ${isCheapest ? `<span class="cheapest-badge" style="position:absolute; top:12px; right:12px; font-size:11px; font-weight:700; color:var(--success); background:var(--success-glow); padding:4px 8px; border-radius:6px; text-transform:uppercase; letter-spacing:0.05em;">🏆 Cheapest Basket</span>` : ""}
        <div class="comp-header-row">
          <div class="comp-logo-box" style="background: ${store.color}; color: ${store.textCol}; display: flex; align-items: center; justify-content: center;">
            <i data-lucide="${store.icon}"></i>
          </div>
          <div class="comp-store-info">
            <h4>${store.name}</h4>
            <p>${store.branch}</p>
          </div>
        </div>
        <div class="comp-price-summary">
          <span class="comp-price-label">Estimated Basket</span>
          <span class="comp-total-cost">€${res.total.toFixed(2)}</span>
        </div>
        <div class="comp-items-breakdown">
          ${breakdownRows}
        </div>
      `;
      
      container.appendChild(card);
    });
    
    // Render newly inserted Lucide icons
    if (window.lucide) window.lucide.createIcons();
  }

  // Bind Restore starter list / clear list buttons
  const listRestoreStarterBtn = document.getElementById("listRestoreStarterBtn");
  const listClearAllBtn = document.getElementById("listClearAllBtn");

  if (listRestoreStarterBtn) {
    listRestoreStarterBtn.addEventListener("click", () => {
      currentShoppingList = JSON.parse(JSON.stringify(INITIAL_SHOPPING_LIST));
      renderShoppingChecklist();
      calculateStoreCosts();
    });
  }

  if (listClearAllBtn) {
    listClearAllBtn.addEventListener("click", () => {
      currentShoppingList = [];
      renderShoppingChecklist();
      calculateStoreCosts();
    });
  }

  // --------------------------------------------------------------------------
  // 13. Reusable Autocomplete & Input Clears
  // --------------------------------------------------------------------------
  function bindAutocomplete(inputId, popoverId, onSelect) {
    const input = document.getElementById(inputId);
    const popover = document.getElementById(popoverId);
    if (!input || !popover) return;
    
    const clearBtnId = inputId === "listProductSearch" ? "listSearchClearBtn" : "trendsSearchClearBtn";
    const clearBtn = document.getElementById(clearBtnId);
    
    function updateClearBtn() {
      if (clearBtn) {
        clearBtn.style.display = input.value.trim() ? "block" : "none";
      }
    }

    input.addEventListener("input", () => {
      updateClearBtn();
      const query = input.value.toLowerCase().trim();
      if (!query) {
        popover.style.display = "none";
        return;
      }
      
      const matches = starterVocabulary.filter(item => item.toLowerCase().includes(query));
      if (matches.length === 0) {
        popover.style.display = "none";
        return;
      }
      
      popover.innerHTML = "";
      matches.forEach(match => {
        const item = document.createElement("div");
        item.className = "autocomplete-item";
        
        const prices = storePrices[match];
        let priceInfo = "";
        if (prices) {
          const prList = Object.values(prices);
          const minP = Math.min(...prList);
          priceInfo = `<span style="font-size:11px; color:var(--text-muted);">from €${minP.toFixed(2)}</span>`;
        }
        
        item.innerHTML = `
          <span>${match}</span>
          ${priceInfo}
        `;
        item.addEventListener("click", () => {
          input.value = match;
          popover.style.display = "none";
          updateClearBtn();
          if (onSelect) onSelect(match);
        });
        popover.appendChild(item);
      });
      
      popover.style.display = "block";
    });

    input.addEventListener("focus", () => {
      updateClearBtn();
      const query = input.value.toLowerCase().trim();
      const matches = query ? starterVocabulary.filter(item => item.toLowerCase().includes(query)) : starterVocabulary;
      
      popover.innerHTML = "";
      matches.forEach(match => {
        const item = document.createElement("div");
        item.className = "autocomplete-item";
        const prices = storePrices[match];
        let priceInfo = "";
        if (prices) {
          const prList = Object.values(prices);
          const minP = Math.min(...prList);
          priceInfo = `<span style="font-size:11px; color:var(--text-muted);">from €${minP.toFixed(2)}</span>`;
        }
        item.innerHTML = `
          <span>${match}</span>
          ${priceInfo}
        `;
        item.addEventListener("click", () => {
          input.value = match;
          popover.style.display = "none";
          updateClearBtn();
          if (onSelect) onSelect(match);
        });
        popover.appendChild(item);
      });
      popover.style.display = "block";
    });

    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !popover.contains(e.target)) {
        popover.style.display = "none";
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        input.value = "";
        popover.style.display = "none";
        updateClearBtn();
        input.focus();
        if (inputId === "trendsProductSearch") {
          drawTrendsChart();
        }
      });
    }
  }

  // Bind Autocompletes
  bindAutocomplete("listProductSearch", "listAutocompletePopover", (selected) => {
    addProductToShoppingList(selected);
  });

  bindAutocomplete("trendsProductSearch", "trendsAutocompletePopover", (selected) => {
    drawTrendsChart();
  });

  // --------------------------------------------------------------------------
  // 14. Historical Price Trends SVG Charts
  // --------------------------------------------------------------------------
  const reportsStores = [
    { key: "ah", name: "Albert Heijn", color: "#0ea5e9" },
    { key: "jumbo", name: "Jumbo", color: "#f59e0b" },
    { key: "dirk", name: "Dirk", color: "#ef4444" },
    { key: "lidl", name: "Lidl", color: "#8b5cf6" }
  ];

  function generateTrendData(product, period, store) {
    let hash = 0;
    for (let i = 0; i < product.length; i++) {
      hash = product.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    let basePrice = 5.0;
    const products = {
      "Organic Whole Milk 1L": 1.15,
      "Organic Avocados": 1.39,
      "Fairtrade Bananas": 1.89,
      "Jasmine Rice 5kg": 12.99,
      "Eggs 12-pack": 3.19,
      "Sourdough Bread 800g": 2.60,
      "Bulk Coffee Beans 1kg": 18.90,
      "Premium Soy Sauce 500ml": 4.20,
      "Red Sangria 1L": 4.99
    };
    if (products[product]) {
      basePrice = products[product];
    } else {
      basePrice = Math.abs(hash % 20) + 1.5;
    }

    const storeModifiers = {
      "ah": { mult: 1.05, phase: 0 },
      "jumbo": { mult: 1.00, phase: 2 },
      "dirk": { mult: 0.90, phase: 4 },
      "lidl": { mult: 0.93, phase: 1 }
    };
    const mod = storeModifiers[store] || { mult: 1.0, phase: 0 };
    
    let numPoints = 6;
    let timeLabels = [];
    let dates = [];
    
    if (period === "30d") {
      numPoints = 6;
      for (let i = 5; i >= 0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i * 6);
        timeLabels.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
        dates.push(d);
      }
    } else if (period === "90d") {
      numPoints = 6;
      for (let i = 5; i >= 0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i * 18);
        timeLabels.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
        dates.push(d);
      }
    } else if (period === "180d") {
      numPoints = 6;
      for (let i = 5; i >= 0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i * 36);
        timeLabels.push(d.toLocaleDateString("en-US", { month: "short" }));
        dates.push(d);
      }
    } else { // 1y
      numPoints = 12;
      for (let i = 11; i >= 0; i--) {
        let d = new Date();
        d.setMonth(d.getMonth() - i);
        timeLabels.push(d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
        dates.push(d);
      }
    }

    let prices = [];
    for (let i = 0; i < numPoints; i++) {
      let angle = (i + mod.phase + (hash % 10)) * 0.5;
      let wave = Math.sin(angle) * 0.05 * basePrice;
      let noise = ((hash + i) % 5) * 0.01 * basePrice;
      let price = basePrice * mod.mult + wave + noise;
      prices.push(parseFloat(price.toFixed(2)));
    }

    return {
      labels: timeLabels,
      prices: prices,
      dates: dates
    };
  }

  function renderStoreFilters() {
    const container = document.getElementById("trendsStoreFilters");
    if (!container) return;
    container.innerHTML = "";
    
    reportsStores.forEach(store => {
      const row = document.createElement("div");
      row.className = "store-checkbox-row active";
      row.dataset.store = store.key;
      row.innerHTML = `
        <div class="store-label-side">
          <span class="store-dot-indicator" style="background-color: ${store.color};"></span>
          ${store.name}
        </div>
        <div class="custom-checkbox-wrapper">
          <span class="check-tick-icon">✓</span>
        </div>
      `;
      
      row.addEventListener("click", () => {
        row.classList.toggle("active");
        drawTrendsChart();
      });
      
      container.appendChild(row);
    });
  }

  function drawTrendsChart() {
    const productInput = document.getElementById("trendsProductSearch");
    const productTitle = document.getElementById("trendsChartProductTitle");
    if (!productInput) return;
    const product = productInput.value || "Organic Whole Milk 1L";
    if (productTitle) productTitle.textContent = product;
    
    const activePeriodBtn = document.querySelector("#trendsPeriodControl .segment-btn.active");
    const period = activePeriodBtn ? activePeriodBtn.dataset.period : "90d";
    
    const activeStoreRows = document.querySelectorAll("#trendsStoreFilters .store-checkbox-row.active");
    const checkedStoreKeys = Array.from(activeStoreRows).map(row => row.dataset.store);
    
    const legendContainer = document.getElementById("trendsChartLegend");
    if (legendContainer) {
      legendContainer.innerHTML = "";
      reportsStores.forEach(store => {
        if (checkedStoreKeys.includes(store.key)) {
          const item = document.createElement("div");
          item.className = "legend-item";
          item.innerHTML = `
            <span class="legend-dot" style="background-color: ${store.color};"></span>
            ${store.name}
          `;
          legendContainer.appendChild(item);
        }
      });
    }

    const chartContainer = document.getElementById("trendsChartContainer");
    if (!chartContainer) return;
    chartContainer.innerHTML = "";

    if (checkedStoreKeys.length === 0) {
      chartContainer.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-secondary); font-size:14px;">
          Please select at least one retailer to compare price history.
        </div>
      `;
      const insightDesc = document.getElementById("trendsInsightDesc");
      if (insightDesc) insightDesc.innerHTML = "Select a retailer to see price insight comparisons.";
      return;
    }

    const storeData = {};
    let allPrices = [];
    let labels = [];
    
    checkedStoreKeys.forEach(key => {
      const data = generateTrendData(product, period, key);
      storeData[key] = data;
      allPrices = allPrices.concat(data.prices);
      if (labels.length === 0) {
        labels = data.labels;
      }
    });

    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    
    let cheapestStoreKey = "";
    let cheapestStorePrice = Infinity;
    checkedStoreKeys.forEach(key => {
      const prices = storeData[key].prices;
      const lastPrice = prices[prices.length - 1];
      if (lastPrice < cheapestStorePrice) {
        cheapestStorePrice = lastPrice;
        cheapestStoreKey = key;
      }
    });
    
    const cheapestStoreObj = reportsStores.find(s => s.key === cheapestStoreKey);
    const insightTitle = document.getElementById("trendsInsightTitle");
    const insightDesc = document.getElementById("trendsInsightDesc");
    if (cheapestStoreObj && insightDesc) {
      if (insightTitle) insightTitle.textContent = "Lowest Pricing Match";
      insightDesc.innerHTML = `${cheapestStoreObj.name} currently offers the lowest unit price for <strong>${product}</strong> at <strong>€${cheapestStorePrice.toFixed(2)}</strong>.`;
    }

    const width = 600;
    const height = 300;
    const paddingLeft = 55;
    const paddingRight = 30;
    const paddingTop = 20;
    const paddingBottom = 45;
    
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;
    
    let overallMin = minPrice * 0.97;
    let overallMax = maxPrice * 1.03;
    if (overallMin === overallMax) {
      overallMin -= 1;
      overallMax += 1;
    }
    
    const priceRange = overallMax - overallMin;
    
    let svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="overflow:visible;" xmlns="http://www.w3.org/2000/svg">`;
    
    const numGridLines = 4;
    for (let i = 0; i <= numGridLines; i++) {
      const yVal = overallMin + (priceRange * i) / numGridLines;
      const yPos = height - paddingBottom - (plotHeight * i) / numGridLines;
      
      svgContent += `<line x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" class="chart-grid-line" />`;
      svgContent += `<text x="${paddingLeft - 10}" y="${yPos + 3}" text-anchor="end" class="chart-axis-text">€${yVal.toFixed(2)}</text>`;
    }
    
    const numPoints = labels.length;
    const xCoords = [];
    
    for (let i = 0; i < numPoints; i++) {
      const xPos = paddingLeft + (plotWidth * i) / (numPoints - 1);
      xCoords.push(xPos);
      
      svgContent += `<line x1="${xPos}" y1="${height - paddingBottom}" x2="${xPos}" y2="${height - paddingBottom + 5}" class="chart-axis-line" />`;
      svgContent += `<text x="${xPos}" y="${height - paddingBottom + 20}" text-anchor="middle" class="chart-axis-text">${labels[i]}</text>`;
    }
    
    checkedStoreKeys.forEach(key => {
      const storeObj = reportsStores.find(s => s.key === key);
      const data = storeData[key];
      let pathD = "";
      
      for (let i = 0; i < numPoints; i++) {
        const x = xCoords[i];
        const y = height - paddingBottom - ((data.prices[i] - overallMin) / priceRange) * plotHeight;
        if (i === 0) {
          pathD += `M ${x} ${y}`;
        } else {
          pathD += ` L ${x} ${y}`;
        }
      }
      
      svgContent += `<path d="${pathD}" class="chart-trend-line" stroke="${storeObj.color}" />`;
      
      for (let i = 0; i < numPoints; i++) {
        const x = xCoords[i];
        const y = height - paddingBottom - ((data.prices[i] - overallMin) / priceRange) * plotHeight;
        svgContent += `
          <circle cx="${x}" cy="${y}" r="4" 
                  class="chart-data-dot" 
                  fill="${storeObj.color}" 
                  stroke="var(--deep-space)" 
                  data-store="${storeObj.name}"
                  data-date="${labels[i]}"
                  data-price="€${data.prices[i].toFixed(2)}"
                  data-index="${i}" />
        `;
      }
    });
    
    svgContent += `<line id="chartHoverGuide" x1="0" y1="${paddingTop}" x2="0" y2="${height - paddingBottom}" class="chart-vertical-guide" style="display:none;" />`;
    
    svgContent += `</svg>`;
    chartContainer.innerHTML = svgContent;
    
    const guide = chartContainer.querySelector("#chartHoverGuide");
    const tooltip = document.getElementById("trendsChartTooltip");
    
    chartContainer.addEventListener("mousemove", (e) => {
      const rect = chartContainer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const svgWidth = rect.width;
      const scaleFactor = width / svgWidth;
      const targetX = mouseX * scaleFactor;
      
      let closestIdx = 0;
      let minDiff = Infinity;
      xCoords.forEach((x, idx) => {
        const diff = Math.abs(x - targetX);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      
      const snapX = xCoords[closestIdx];
      
      if (guide) {
        guide.setAttribute("x1", snapX);
        guide.setAttribute("x2", snapX);
        guide.style.display = "block";
      }
      
      if (tooltip) {
        const dateLabel = labels[closestIdx];
        
        const items = checkedStoreKeys.map(key => {
          const storeObj = reportsStores.find(s => s.key === key);
          return {
            name: storeObj.name,
            price: storeData[key].prices[closestIdx],
            color: storeObj.color
          };
        }).sort((a, b) => a.price - b.price);
        
        let tooltipHtml = `<div class="tooltip-date">${dateLabel}</div>`;
        items.forEach((item, idx) => {
          const isCheapest = idx === 0;
          const colorStyle = isCheapest ? `color: var(--success); font-weight:700;` : ``;
          tooltipHtml += `
            <div class="tooltip-item" style="${colorStyle}">
              <span class="tooltip-store" style="display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:${item.color};"></span>
                ${item.name} ${isCheapest ? "🏆" : ""}
              </span>
              <span class="tooltip-price">€${item.price.toFixed(2)}</span>
            </div>
          `;
        });
        
        tooltip.innerHTML = tooltipHtml;
        tooltip.style.display = "block";
        
        const tooltipRect = tooltip.getBoundingClientRect();
        const containerRect = chartContainer.getBoundingClientRect();
        
        let xPos = (snapX / scaleFactor) + 15;
        let yPos = mouseY - 20;
        
        if (xPos + tooltipRect.width > containerRect.width) {
          xPos = (snapX / scaleFactor) - tooltipRect.width - 15;
        }
        if (yPos + tooltipRect.height > containerRect.height) {
          yPos = containerRect.height - tooltipRect.height - 10;
        }
        if (yPos < 10) yPos = 10;
        
        tooltip.style.left = `${xPos}px`;
        tooltip.style.top = `${yPos}px`;
      }
    });
    
    chartContainer.addEventListener("mouseleave", () => {
      if (guide) guide.style.display = "none";
      if (tooltip) tooltip.style.display = "none";
    });
  }

  // Bind segmented control time scales
  const periodControl = document.getElementById("trendsPeriodControl");
  if (periodControl) {
    const btns = periodControl.querySelectorAll(".segment-btn");
    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        btns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        drawTrendsChart();
      });
    });
  }

  // --------------------------------------------------------------------------
  // 15. Budgets Settings Sliders & Definitions
  // --------------------------------------------------------------------------
  const btnDefineBudget = document.getElementById("btnDefineBudget");
  if (btnDefineBudget) {
    btnDefineBudget.addEventListener("click", () => {
      const category = prompt("Enter category name (e.g. Travel, Entertainment):");
      if (category && category.trim()) {
        const limitStr = prompt("Enter monthly spending limit (€):", "200");
        const limit = parseFloat(limitStr);
        if (!isNaN(limit) && limit > 0) {
          alert(`New budget defined: ${category} with a limit of €${limit.toFixed(2)}.`);
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // 16. Settings & GDPR Compliance Controls
  // --------------------------------------------------------------------------
  const settingsPriceContribution = document.getElementById("settingsPriceContribution");
  const settingsExportBtn = document.getElementById("settingsExportBtn");
  const settingsDeleteBtn = document.getElementById("settingsDeleteBtn");

  if (settingsPriceContribution) {
    settingsPriceContribution.addEventListener("change", () => {
      const optVal = settingsPriceContribution.checked ? "enabled" : "disabled";
      alert(`Privacy settings updated: Price contribution to community price index is now ${optVal}. Anonymized observational emission will be updated accordingly.`);
    });
  }

  if (settingsExportBtn) {
    settingsExportBtn.addEventListener("click", () => {
      settingsExportBtn.disabled = true;
      settingsExportBtn.textContent = "Compiling index (Art. 20)...";
      
      setTimeout(() => {
        settingsExportBtn.textContent = "Downloading ZIP...";
        
        setTimeout(() => {
          settingsExportBtn.textContent = "Export My Data";
          settingsExportBtn.disabled = false;
          alert("GDPR Data Portability export compiled! Check your browser downloads for wobblio-export-usr_9a4f210e.zip. Contains all parsed line items, dates, and billing metrics.");
        }, 1200);
      }, 1500);
    });
  }

  if (settingsDeleteBtn) {
    settingsDeleteBtn.addEventListener("click", () => {
      const confirmDelete = confirm("Are you absolutely sure you want to request account erasure under GDPR Article 17?\n\nThis soft-locks your account immediately, followed by a 30-day hard purge. All de-identified price indices will be fully detached from your profile.");
      if (confirmDelete) {
        settingsDeleteBtn.disabled = true;
        settingsDeleteBtn.textContent = "Request Logged";
        alert("Article 17 deletion request logged. You will receive a confirmation email within 24 hours. Redirecting to landing page...");
        setTimeout(() => {
          showView("landing");
          settingsDeleteBtn.disabled = false;
          settingsDeleteBtn.textContent = "Delete My Account";
        }, 1500);
      }
    });
  }

  // Add list helper function
  function addProductToShoppingList(productName) {
    const existing = currentShoppingList.find(item => item.name === productName);
    if (existing) {
      existing.qty += 1;
    } else {
      currentShoppingList.push({
        name: productName,
        qty: 1,
        checked: false
      });
    }
    const searchInput = document.getElementById("listProductSearch");
    if (searchInput) searchInput.value = "";
    const clearBtn = document.getElementById("listSearchClearBtn");
    if (clearBtn) clearBtn.style.display = "none";
    
    renderShoppingChecklist();
    calculateStoreCosts();
  }

  // Initial runs
  renderShoppingChecklist();
  calculateStoreCosts();
  renderStoreFilters();
  drawTrendsChart();

  // Switch to dashboard view inside workspace initially
  switchWorkspacePane("dashboard");

});
