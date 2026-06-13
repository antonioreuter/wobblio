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
    spending: document.getElementById("railSpending"),
    analytics: document.getElementById("railAnalytics"),
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
    spending: document.getElementById("paneSpending"),
    analytics: document.getElementById("paneAnalytics"),
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
      if (railBtns[key]) {
        if (key === paneKey) {
          railBtns[key].classList.add("active");
        } else {
          railBtns[key].classList.remove("active");
        }
      }
    });

    // Toggle panes display
    Object.keys(panes).forEach(key => {
      if (panes[key]) {
        if (key === paneKey) {
          panes[key].classList.add("active");
        } else {
          panes[key].classList.remove("active");
        }
      }
    });

    if (paneKey === "spending") {
      drawSpendingBreakdown();
    } else if (paneKey === "analytics") {
      drawWeeklySpendAnalytics();
    }

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
  // 5. Invoices Filter List Toggle & Search (Advanced Parity Version)
  // --------------------------------------------------------------------------
  const ledgerSearchInput = document.getElementById("ledgerSearchInput");
  const ledgerStoreFilter = document.getElementById("ledgerStoreFilter");
  const ledgerStatusFilter = document.getElementById("ledgerStatusFilter");

  function filterLedgerTable() {
    const query = ledgerSearchInput ? ledgerSearchInput.value.toLowerCase().trim() : "";
    const selectedStore = ledgerStoreFilter ? ledgerStoreFilter.value : "ALL";
    const selectedStatusSelect = ledgerStatusFilter ? ledgerStatusFilter.value : "ALL";
    const activeChip = document.querySelector(".filter-chips-row .filter-chip-btn.active");
    const chipFilter = activeChip ? activeChip.dataset.filter : "all";

    const rows = document.querySelectorAll("#ledgerTable tbody tr");
    rows.forEach(row => {
      const status = row.dataset.status;
      const merchantCell = row.querySelector(".row-merchant-cell");
      const merchant = merchantCell ? merchantCell.textContent.trim() : "";
      const text = row.innerText.toLowerCase();

      // Check status (both from chips and status dropdown)
      const matchesChip = (chipFilter === "all" || status === chipFilter);
      const matchesStatusSelect = (selectedStatusSelect === "ALL" || status === selectedStatusSelect);
      const matchesStore = (selectedStore === "ALL" || merchant === selectedStore);
      const matchesSearch = (query === "" || text.includes(query));

      if (matchesChip && matchesStatusSelect && matchesStore && matchesSearch) {
        row.style.display = "table-row";
      } else {
        row.style.display = "none";
      }
    });
  }

  // Bind ledger filter controls
  if (ledgerSearchInput) ledgerSearchInput.addEventListener("input", filterLedgerTable);
  if (ledgerStoreFilter) ledgerStoreFilter.addEventListener("change", filterLedgerTable);
  if (ledgerStatusFilter) ledgerStatusFilter.addEventListener("change", filterLedgerTable);

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterLedgerTable();
    });
  });

  // Top header search input search filter
  if (appSearchInput) {
    appSearchInput.addEventListener("keyup", () => {
      const query = appSearchInput.value.toLowerCase().trim();
      
      // Switch to invoices list view when the user searches to give feedback
      if (appWorkspaceView.style.display === "block" && !panes.invoices.classList.contains("active") && query !== "") {
        switchWorkspacePane("invoices");
      }

      // Populate ledger search input with header search query so they stay synced
      if (ledgerSearchInput) {
        ledgerSearchInput.value = appSearchInput.value;
      }
      filterLedgerTable();
    });
  }

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

  // ==========================================================================
  // Mock Line Items Database for Spending & Analytics
  // ==========================================================================
  const MOCK_LINE_ITEMS = [
    // Groceries items
    { name: "Organic Whole Milk 1L", category: "Milk & Dairy Drinks", store: "Albert Heijn XL", date: "2026-06-12", price: 1.25, qty: 2, segment: "GROCERIES" },
    { name: "Organic Whole Milk 1L", category: "Milk & Dairy Drinks", store: "Jumbo Oostpoort", date: "2026-06-05", price: 1.19, qty: 3, segment: "GROCERIES" },
    { name: "Organic Whole Milk 1L", category: "Milk & Dairy Drinks", store: "Dirk van den Broek", date: "2026-05-28", price: 1.09, qty: 2, segment: "GROCERIES" },
    { name: "Organic Whole Milk 1L", category: "Milk & Dairy Drinks", store: "Albert Heijn XL", date: "2026-05-15", price: 1.25, qty: 4, segment: "GROCERIES" },
    { name: "Organic Whole Milk 1L", category: "Milk & Dairy Drinks", store: "Jumbo Oostpoort", date: "2026-05-02", price: 1.19, qty: 3, segment: "GROCERIES" },
    
    { name: "Organic Avocados", category: "Fruits & Vegetables", store: "Jumbo Oostpoort", date: "2026-06-12", price: 1.59, qty: 3, segment: "GROCERIES" },
    { name: "Organic Avocados", category: "Fruits & Vegetables", store: "Dirk van den Broek", date: "2026-06-03", price: 1.29, qty: 4, segment: "GROCERIES" },
    { name: "Organic Avocados", category: "Fruits & Vegetables", store: "Albert Heijn XL", date: "2026-05-20", price: 1.49, qty: 2, segment: "GROCERIES" },
    
    { name: "Sourdough Bread 800g", category: "Bread & Bakery", store: "Dirk van den Broek", date: "2026-06-11", price: 2.45, qty: 1, segment: "GROCERIES" },
    { name: "Sourdough Bread 800g", category: "Bread & Bakery", store: "Jumbo Oostpoort", date: "2026-05-25", price: 2.60, qty: 2, segment: "GROCERIES" },
    
    { name: "Eggs 12-pack", category: "Yogurt, Eggs & Chilled Desserts", store: "Albert Heijn XL", date: "2026-06-10", price: 3.49, qty: 1, segment: "GROCERIES" },
    { name: "Eggs 12-pack", category: "Yogurt, Eggs & Chilled Desserts", store: "Dirk van den Broek", date: "2026-05-05", price: 2.99, qty: 2, segment: "GROCERIES" },
    
    { name: "Jasmine Rice 5kg", category: "Pasta, Rice & Grains", store: "Dirk van den Broek", date: "2026-06-09", price: 12.50, qty: 1, segment: "GROCERIES" },
    { name: "Jasmine Rice 5kg", category: "Pasta, Rice & Grains", store: "Albert Heijn XL", date: "2026-05-18", price: 13.50, qty: 1, segment: "GROCERIES" },
    
    { name: "Bulk Coffee Beans 1kg", category: "Coffee & Tea", store: "Albert Heijn XL", date: "2026-06-06", price: 19.50, qty: 1, segment: "GROCERIES" },
    { name: "Bulk Coffee Beans 1kg", category: "Coffee & Tea", store: "Jumbo Oostpoort", date: "2026-05-12", price: 18.90, qty: 2, segment: "GROCERIES" },
    
    { name: "Premium Soy Sauce 500ml", category: "Sauces, Condiments & Seasonings", store: "Jumbo Oostpoort", date: "2026-06-09", price: 4.20, qty: 1, segment: "GROCERIES" },
    { name: "Red Sangria 1L", category: "Wine, Champagne & Spirits", store: "Albert Heijn XL", date: "2026-06-12", price: 5.50, qty: 1, segment: "GROCERIES" },
    
    { name: "Greek Yoghurt 5% Fat 1kg", category: "Yogurt, Eggs & Chilled Desserts", store: "Jumbo Oostpoort", date: "2026-06-12", price: 3.89, qty: 1, segment: "GROCERIES" },
    { name: "Pesto Genovese 190g", category: "Sauces, Condiments & Seasonings", store: "Jumbo Oostpoort", date: "2026-06-12", price: 2.29, qty: 1, segment: "GROCERIES" },
    { name: "Barilla Penne Rigate 500g", category: "Pasta, Rice & Grains", store: "Jumbo Oostpoort", date: "2026-06-12", price: 1.49, qty: 1, segment: "GROCERIES" },
    { name: "Organic Tomatoes 500g", category: "Fruits & Vegetables", store: "Jumbo Oostpoort", date: "2026-06-12", price: 2.99, qty: 1, segment: "GROCERIES" },
    { name: "Extra Virgin Olive Oil 750ml", category: "Baking & Cooking Ingredients", store: "Jumbo Oostpoort", date: "2026-06-12", price: 7.90, qty: 1, segment: "GROCERIES" },
    { name: "Free Range Chicken Breast 600g", category: "Fresh Meat & Poultry", store: "Albert Heijn XL", date: "2026-06-06", price: 9.20, qty: 1, segment: "GROCERIES" },
    { name: "Parmigiano Reggiano 200g", category: "Cheese & Butter", store: "Albert Heijn XL", date: "2026-06-06", price: 5.80, qty: 1, segment: "GROCERIES" },
    
    // Drugstore items
    { name: "Paracetamol 500mg", category: "OTC Medicine & Pharmacy", store: "Etos", date: "2026-06-12", price: 1.99, qty: 2, segment: "DRUGSTORE" },
    { name: "Paracetamol 500mg", category: "OTC Medicine & Pharmacy", store: "Kruidvat", date: "2026-05-24", price: 1.89, qty: 3, segment: "DRUGSTORE" },
    { name: "Sensodyne Oral Care", category: "Oral Care", store: "Kruidvat", date: "2026-06-11", price: 3.49, qty: 1, segment: "DRUGSTORE" },
    { name: "Sensodyne Oral Care", category: "Oral Care", store: "Etos", date: "2026-05-14", price: 3.69, qty: 2, segment: "DRUGSTORE" },
    { name: "Shower Gel Men 250ml", category: "Bath, Body & Personal Hygiene", store: "Etos", date: "2026-06-10", price: 2.89, qty: 1, segment: "DRUGSTORE" },
    { name: "Shower Gel Men 250ml", category: "Bath, Body & Personal Hygiene", store: "Kruidvat", date: "2026-05-30", price: 2.79, qty: 2, segment: "DRUGSTORE" },
    { name: "Hair Conditioner 200ml", category: "Hair Care & Styling", store: "Kruidvat", date: "2026-06-08", price: 4.50, qty: 1, segment: "DRUGSTORE" },
    { name: "Vitamin C 1000mg", category: "Vitamins, Supplements & Nutrition", store: "Etos", date: "2026-06-05", price: 6.99, qty: 1, segment: "DRUGSTORE" }
  ];

  // ISO Monday of a given date as YYYY-MM-DD
  function getIsoMonday(dateStr) {
    const d = new Date(dateStr + "T00:00:00Z");
    const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
    d.setUTCDate(d.getUTCDate() - dayNum);
    return d.toISOString().split("T")[0];
  }

  // ISO Week label (e.g. 2026-W24)
  function getIsoWeekLabel(dateStr) {
    const d = new Date(dateStr + "T00:00:00Z");
    const dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 3); // Nearest Thursday
    const jan1 = new Date(d.getUTCFullYear(), 0, 4);
    const jan1Monday = new Date(jan1.getTime());
    jan1Monday.setUTCDate(jan1.getUTCDate() - ((jan1.getUTCDay() + 6) % 7));
    const weekNum = Math.round(((d.getTime() - jan1Monday.getTime()) / 86400000) / 7) + 1;
    return `${d.getUTCFullYear()}-W${weekNum < 10 ? '0' + weekNum : weekNum}`;
  }

  // Filter line items based on filters
  function getFilteredMockItems(fromDate, toDate, storeSegment) {
    return MOCK_LINE_ITEMS.filter(item => {
      const matchesSegment = item.segment === storeSegment;
      const matchesFrom = !fromDate || item.date >= fromDate;
      const matchesTo = !toDate || item.date <= toDate;
      return matchesSegment && matchesFrom && matchesTo;
    });
  }

  // 1. Spending Breakdown Stats
  function getInvoiceStats(fromDate, toDate, storeSegment) {
    const items = getFilteredMockItems(fromDate, toDate, storeSegment);
    const categoryTotals = {};
    const processedDates = new Set();

    items.forEach(item => {
      processedDates.add(item.date);
      if (!categoryTotals[item.category]) {
        categoryTotals[item.category] = { category: item.category, totalSpent: 0 };
      }
      categoryTotals[item.category].totalSpent += item.price * item.qty;
    });

    const categorySpending = Object.values(categoryTotals).sort((a, b) => b.totalSpent - a.totalSpent);
    return {
      categorySpending,
      processedCount: processedDates.size
    };
  }

  // 2. Product drill-down within a category
  function getCategoryProductStats(category, fromDate, toDate, storeSegment) {
    const items = getFilteredMockItems(fromDate, toDate, storeSegment);
    const productTotals = {};

    items.forEach(item => {
      if (item.category === category) {
        if (!productTotals[item.name]) {
          productTotals[item.name] = { productName: item.name, totalSpent: 0 };
        }
        productTotals[item.name].totalSpent += item.price * item.qty;
      }
    });

    return Object.values(productTotals).sort((a, b) => b.totalSpent - a.totalSpent);
  }

  // 3. Weekly spending stats
  function getWeeklySpendingStats(fromDate, toDate, storeSegment) {
    const items = getFilteredMockItems(fromDate, toDate, storeSegment);
    const weeklyStoreTotals = {};
    const storeTotals = {};

    items.forEach(item => {
      const weekLabel = getIsoWeekLabel(item.date);
      const weekStartDate = getIsoMonday(item.date);
      const key = `${weekLabel}_${item.store}`;

      if (!weeklyStoreTotals[key]) {
        weeklyStoreTotals[key] = {
          weekLabel,
          weekStartDate,
          storeName: item.store,
          totalSpent: 0,
          invoiceCount: new Set()
        };
      }
      weeklyStoreTotals[key].totalSpent += item.price * item.qty;
      weeklyStoreTotals[key].invoiceCount.add(item.date);

      if (!storeTotals[item.store]) {
        storeTotals[item.store] = { storeName: item.store, totalSpent: 0 };
      }
      storeTotals[item.store].totalSpent += item.price * item.qty;
    });

    const weeks = Object.values(weeklyStoreTotals).map(w => ({
      ...w,
      invoiceCount: w.invoiceCount.size
    })).sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));

    const retailerTotals = Object.values(storeTotals).sort((a, b) => b.totalSpent - a.totalSpent);

    return {
      weeks,
      retailerTotals
    };
  }

  const CATEGORY_COLOR_MAP = {
    'Fruits & Vegetables': '#10b981',
    'Bread & Bakery': '#b45309',
    'Yogurt, Eggs & Chilled Desserts': '#0d9488',
    'Pasta, Rice & Grains': '#6366f1',
    'Coffee & Tea': '#78350f',
    'Sauces, Condiments & Seasonings': '#dc2626',
    'Wine, Champagne & Spirits': '#881337',
    'Baking & Cooking Ingredients': '#d97706',
    'Fresh Meat & Poultry': '#ef4444',
    'Cheese & Butter': '#eab308',
    'OTC Medicine & Pharmacy': '#be123c',
    'Oral Care': '#22d3ee',
    'Bath, Body & Personal Hygiene': '#4f46e5',
    'Hair Care & Styling': '#a855f7',
    'Vitamins, Supplements & Nutrition': '#16a34a',
    'Other / General': '#94a3b8'
  };
  function getCategoryColor(category) {
    return CATEGORY_COLOR_MAP[category] || '#94a3b8';
  }

  let activeSpendingCategory = null;

  function rangeForPresetSpending(preset) {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const daysAgo = (n) => {
      const d = new Date();
      d.setDate(now.getDate() - n);
      return d.toISOString().split("T")[0];
    };

    switch (preset) {
      case "today":
        return { from: today, to: today };
      case "last-7":
        return { from: daysAgo(7), to: today };
      case "last-30":
        return { from: daysAgo(30), to: today };
      case "last-90":
        return { from: daysAgo(90), to: today };
      default:
        return { from: "", to: "" };
    }
  }

  function drawSpendingBreakdown() {
    const segmentBtn = document.querySelector("#spendingSegmentControl .segment-btn.active");
    const storeSegment = segmentBtn ? segmentBtn.dataset.segment : "GROCERIES";

    const fromDateInput = document.getElementById("spendingFromDate");
    const toDateInput = document.getElementById("spendingToDate");
    const fromDate = fromDateInput ? fromDateInput.value : "";
    const toDate = toDateInput ? toDateInput.value : "";

    const searchInput = document.getElementById("spendingSearchQuery");
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";

    const activeChip = document.querySelector("#spendingFilterChips .segment-btn.active");
    const filterPreset = activeChip ? activeChip.dataset.filter : "all";

    const chartToggle = document.querySelector("#spendingChartToggle .segment-btn.active");
    const chartType = chartToggle ? chartToggle.dataset.type : "bar";

    const stats = getInvoiceStats(fromDate, toDate, storeSegment);
    const categorySpending = stats.categorySpending;
    const processedCount = stats.processedCount;

    // Sum overall spent
    const categoryTotalSpent = categorySpending.reduce((acc, item) => acc + item.totalSpent, 0);

    // Update headlines
    const totalPeriodEl = document.getElementById("spendingTotalPeriod");
    if (totalPeriodEl) totalPeriodEl.textContent = `€${categoryTotalSpent.toFixed(2)}`;

    const verifiedCountEl = document.getElementById("spendingVerifiedInvoicesText");
    if (verifiedCountEl) verifiedCountEl.textContent = `Calculated over ${processedCount} verified invoices`;

    // Filter categories based on search and presets
    let filteredCategories = [...categorySpending];
    if (searchQuery) {
      filteredCategories = filteredCategories.filter(item => item.category.toLowerCase().includes(searchQuery));
    }
    if (filterPreset === "top-5") {
      filteredCategories = filteredCategories.slice(0, 5);
    } else if (filterPreset === "top-10") {
      filteredCategories = filteredCategories.slice(0, 10);
    } else if (filterPreset === "high-spending") {
      filteredCategories = filteredCategories.filter(item => categoryTotalSpent > 0 && (item.totalSpent / categoryTotalSpent) >= 0.05);
    }

    const filteredTotalSpent = filteredCategories.reduce((acc, item) => acc + item.totalSpent, 0);

    // RENDER CHART
    const chartContainer = document.getElementById("spendingChartContainer");
    if (chartContainer) {
      chartContainer.innerHTML = "";
      if (filteredCategories.length === 0) {
        chartContainer.innerHTML = `
          <div style="text-align:center; padding:40px 20px; color:var(--text-secondary); font-size:13.5px;">
            No category spending records match filters.
          </div>
        `;
      } else if (chartType === "bar") {
        const listWrapper = document.createElement("div");
        listWrapper.style.width = "100%";
        listWrapper.style.display = "flex";
        listWrapper.style.flexDirection = "column";
        listWrapper.style.gap = "20px";
        listWrapper.style.padding = "10px 0";

        filteredCategories.forEach(item => {
          const pct = categoryTotalSpent > 0 ? (item.totalSpent / categoryTotalSpent) * 100 : 0;
          const color = getCategoryColor(item.category);
          
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.flexDirection = "column";
          row.style.gap = "8px";
          row.innerHTML = `
            <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 500; color: var(--text-primary);">
              <span style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${color};"></span>
                ${item.category}
              </span>
              <span>
                <strong>€${item.totalSpent.toFixed(2)}</strong>
                <span class="muted-text" style="margin-left: 8px; font-size:12px; color:var(--text-secondary);">(${pct.toFixed(1)}%)</span>
              </span>
            </div>
            <div style="width: 100%; height: 10px; background: rgba(255,255,255,0.05); border-radius: 5px; overflow: hidden; position: relative;">
              <div style="width: ${pct}%; height: 100%; background-color: ${color}; border-radius: 5px; transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 0 8px ${color}80;"></div>
            </div>
          `;
          listWrapper.appendChild(row);
        });
        chartContainer.appendChild(listWrapper);
      } else {
        // DONUT CHART
        const radius = 50;
        const circumference = 2 * Math.PI * radius;
        let accumulatedAngle = -90;

        const donutSegments = filteredCategories.map(item => {
          const percentage = categoryTotalSpent > 0 ? (item.totalSpent / categoryTotalSpent) * 100 : 0;
          const angle = filteredTotalSpent > 0 ? (item.totalSpent / filteredTotalSpent) * 360 : 0;
          const segmentLength = filteredTotalSpent > 0 ? (item.totalSpent / filteredTotalSpent) * circumference : 0;
          const strokeOffset = circumference - segmentLength;
          const startAngle = accumulatedAngle;
          accumulatedAngle += angle;

          return { ...item, percentage, strokeOffset, segmentLength, circumference, startAngle };
        });

        const donutWrapper = document.createElement("div");
        donutWrapper.style.position = "relative";
        donutWrapper.style.width = "220px";
        donutWrapper.style.height = "220px";

        let circles = "";
        donutSegments.forEach(seg => {
          const color = getCategoryColor(seg.category);
          const gapSize = filteredCategories.length > 1 ? 6 : 0;
          const capOffset = 6; 
          const shift = gapSize / 2 + capOffset;
          const strokeLength = Math.max(0.1, seg.segmentLength - gapSize - (capOffset * 2));
          const offset = -((seg.startAngle * Math.PI * radius) / 180 + (filteredCategories.length > 1 ? shift : 0));

          circles += `
            <circle class="donut-segment" cx="60" cy="60" r="${radius}" fill="transparent" stroke="${color}" stroke-width="12"
                    stroke-dasharray="${strokeLength} ${seg.circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
                    data-category="${seg.category}" data-spent="€${seg.totalSpent.toFixed(2)}" data-pct="${seg.percentage.toFixed(1)}%" style="cursor:pointer;" />
          `;
        });

        donutWrapper.innerHTML = `
          <svg class="donut-chart-svg" width="100%" height="100%" viewBox="0 0 120 120" style="transform: rotate(-90deg); overflow: visible;">
            <circle cx="60" cy="60" r="${radius}" fill="transparent" stroke="rgba(255,255,255,0.03)" stroke-width="12" />
            ${circles}
          </svg>
          <div id="donutCenterText" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; width: 140px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <span class="muted-text" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color:var(--text-secondary);">Total Spent</span>
            <div style="font-size: 18px; font-weight: 800; margin-top: 2px; color: var(--text-primary);">€${filteredTotalSpent.toFixed(2)}</div>
          </div>
        `;

        chartContainer.appendChild(donutWrapper);

        // Donut hover listeners
        const segments = donutWrapper.querySelectorAll(".donut-segment");
        const centerText = donutWrapper.querySelector("#donutCenterText");
        segments.forEach(seg => {
          seg.addEventListener("mouseenter", () => {
            const cat = seg.dataset.category;
            const spent = seg.dataset.spent;
            const pct = seg.dataset.pct;
            const color = getCategoryColor(cat);
            centerText.innerHTML = `
              <span style="font-size: 10px; font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 0.05em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">${cat}</span>
              <div style="font-size: 18px; font-weight: 800; margin-top: 2px; color: var(--text-primary);">${spent}</div>
              <span class="muted-text" style="font-size: 10px; margin-top: 2px; color:var(--text-secondary);">${pct}</span>
            `;
          });
          seg.addEventListener("mouseleave", () => {
            centerText.innerHTML = `
              <span class="muted-text" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color:var(--text-secondary);">Total Spent</span>
              <div style="font-size: 18px; font-weight: 800; margin-top: 2px; color: var(--text-primary);">€${filteredTotalSpent.toFixed(2)}</div>
            `;
          });
        });
      }
    }

    // RENDER DETAILED CATEGORIES LIST
    const listContainer = document.getElementById("spendingCategoryList");
    if (listContainer) {
      listContainer.innerHTML = "";
      if (filteredCategories.length === 0) {
        listContainer.innerHTML = `
          <div style="padding: 32px 16px; text-align: center;" class="muted-text">
            <p style="margin: 0; font-size: 13.5px; color: var(--text-secondary);">No categories found matching filters.</p>
          </div>
        `;
      } else {
        filteredCategories.forEach(item => {
          const pct = categoryTotalSpent > 0 ? (item.totalSpent / categoryTotalSpent) * 100 : 0;
          const color = getCategoryColor(item.category);
          const isExpanded = activeSpendingCategory === item.category;

          const card = document.createElement("div");
          card.className = `category-item-card ${isExpanded ? "expanded" : ""}`;
          if (isExpanded) {
            card.style.borderColor = color;
          }

          card.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; user-select: none;">
              <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                <div style="width: 12px; height: 12px; border-radius: 4px; background-color: ${color}; flex-shrink: 0;"></div>
                <span style="font-weight: 600; font-size: 14px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.category}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                <div style="text-align: right;">
                  <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">€${item.totalSpent.toFixed(2)}</div>
                  <div class="muted-text" style="font-size: 11px; margin-top: 2px; color: var(--text-secondary);">${pct.toFixed(1)}% of total</div>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" class="expand-icon" style="color: var(--text-secondary); transition: transform 0.2s ease; transform: ${isExpanded ? "rotate(180deg)" : "rotate(0deg)"};"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div class="product-drilldown-container" style="display: ${isExpanded ? "block" : "none"}; border-top: 1px solid var(--glass-border); padding: 12px 16px; background: rgba(0,0,0,0.15);">
              <!-- Products will be injected here -->
            </div>
          `;

          const header = card.querySelector("div");
          header.addEventListener("click", () => {
            if (activeSpendingCategory === item.category) {
              activeSpendingCategory = null;
            } else {
              activeSpendingCategory = item.category;
            }
            drawSpendingBreakdown();
          });

          // If expanded, populate products
          if (isExpanded) {
            const productContainer = card.querySelector(".product-drilldown-container");
            const products = getCategoryProductStats(item.category, fromDate, toDate, storeSegment);
            if (products.length === 0) {
              productContainer.innerHTML = `<p style="font-size: 12px; color: var(--text-secondary); text-align: center;">No product stats found.</p>`;
            } else {
              productContainer.innerHTML = "";
              products.forEach(prod => {
                const prodPct = item.totalSpent > 0 ? (prod.totalSpent / item.totalSpent) * 100 : 0;
                const prodRow = document.createElement("div");
                prodRow.style.display = "flex";
                prodRow.style.flexDirection = "column";
                prodRow.style.gap = "6px";
                prodRow.style.marginBottom = "10px";
                prodRow.innerHTML = `
                  <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; min-width: 0; font-size: 13px;">
                    <span style="font-weight:500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${prod.productName}</span>
                    <span style="white-space: nowrap; flex-shrink: 0;">
                      <strong style="color: var(--text-primary);">€${prod.totalSpent.toFixed(2)}</strong>
                      <span class="muted-text" style="margin-left: 6px; font-size: 11px; color: var(--text-secondary);">(${prodPct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${prodPct}%; height: 100%; background-color: ${color}; border-radius: 3px; box-shadow: 0 0 6px ${color}80;"></div>
                  </div>
                `;
                productContainer.appendChild(prodRow);
              });
            }
          }

          listContainer.appendChild(card);
        });
      }
    }
  }

  function initSpendingBreakdownEvents() {
    const segmentBtns = document.querySelectorAll("#spendingSegmentControl .segment-btn");
    segmentBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        segmentBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeSpendingCategory = null;
        drawSpendingBreakdown();
      });
    });

    const presetBtns = document.querySelectorAll("#spendingPresetControl .segment-btn");
    const fromInput = document.getElementById("spendingFromDate");
    const toInput = document.getElementById("spendingToDate");

    function updateInputs(from, to) {
      if (fromInput) fromInput.value = from;
      if (toInput) toInput.value = to;
    }

    // Set initial dates matching the active preset
    const range = rangeForPresetSpending("last-30");
    updateInputs(range.from, range.to);

    presetBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        presetBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const range = rangeForPresetSpending(btn.dataset.preset);
        updateInputs(range.from, range.to);
        activeSpendingCategory = null;
        drawSpendingBreakdown();
      });
    });

    if (fromInput) {
      fromInput.addEventListener("change", () => {
        presetBtns.forEach(b => b.classList.remove("active"));
        activeSpendingCategory = null;
        drawSpendingBreakdown();
      });
    }
    if (toInput) {
      toInput.addEventListener("change", () => {
        presetBtns.forEach(b => b.classList.remove("active"));
        activeSpendingCategory = null;
        drawSpendingBreakdown();
      });
    }

    const chartBtns = document.querySelectorAll("#spendingChartToggle .segment-btn");
    chartBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        chartBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        drawSpendingBreakdown();
      });
    });

    const searchInput = document.getElementById("spendingSearchQuery");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const clearBtn = document.getElementById("spendingSearchClear");
        if (clearBtn) clearBtn.style.display = searchInput.value ? "block" : "none";
        drawSpendingBreakdown();
      });
    }

    const searchClear = document.getElementById("spendingSearchClear");
    if (searchClear) {
      searchClear.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        searchClear.style.display = "none";
        drawSpendingBreakdown();
      });
    }

    const filterBtns = document.querySelectorAll("#spendingFilterChips .segment-btn");
    filterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        drawSpendingBreakdown();
      });
    });
  }

  // ==========================================================================
  // Weekly Retailer Spend Analytics View Logic
  // ==========================================================================
  let selectedFocusRetailers = [];
  let hoveredAnalyticsSegment = null;
  let selectedAnalyticsWeekLabel = null;
  let analyticsTooltipPos = { x: 0, y: 0 };

  const RETAILER_COLORS = {
    "Albert Heijn XL": "#00a1e2",
    "Jumbo Oostpoort": "#f59e0b",
    "Dirk van den Broek": "#ef4444",
    "Etos": "#008080",
    "Kruidvat": "#e2001a"
  };
  function getRetailerColor(store) {
    return RETAILER_COLORS[store] || "#8b5cf6";
  }

  function rangeForPresetAnalytics(preset) {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    
    // ISO monday computation
    const getMonday = (d) => {
      const date = new Date(d);
      const day = (date.getDay() + 6) % 7;
      date.setDate(date.getDate() - day);
      return date.toISOString().split("T")[0];
    };
    
    const daysAgo = (n) => {
      const d = new Date();
      d.setDate(now.getDate() - n);
      return d.toISOString().split("T")[0];
    };

    const thisMonday = getMonday(now);
    const lastMonday = (() => {
      const d = new Date(thisMonday + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 7);
      return d.toISOString().split("T")[0];
    })();
    const lastSunday = (() => {
      const d = new Date(thisMonday + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().split("T")[0];
    })();

    switch (preset) {
      case "this-week":
        return { from: thisMonday, to: today };
      case "last-week":
        return { from: lastMonday, to: lastSunday };
      case "last-2-weeks":
        return { from: lastMonday, to: today };
      case "last-month":
        return { from: daysAgo(30), to: today };
      case "last-3-months":
        return { from: daysAgo(90), to: today };
      default:
        return { from: "", to: "" };
    }
  }

  function drawWeeklySpendAnalytics() {
    const segmentBtn = document.querySelector("#analyticsSegmentControl .segment-btn.active");
    const storeSegment = segmentBtn ? segmentBtn.dataset.segment : "GROCERIES";

    const fromDateInput = document.getElementById("analyticsFromDate");
    const toDateInput = document.getElementById("analyticsToDate");
    const fromDate = fromDateInput ? fromDateInput.value : "";
    const toDate = toDateInput ? toDateInput.value : "";

    // Load initial weekly stats (unfiltered by focus retailers) to get available retailers list
    const stats = getWeeklySpendingStats(fromDate, toDate, storeSegment);
    const weeks = stats.weeks;
    const retailerTotals = stats.retailerTotals;

    // Available retailers in this segment/window
    const availableRetailers = retailerTotals.map(r => r.storeName);

    // Keep only focus retailers that are actually available
    selectedFocusRetailers = selectedFocusRetailers.filter(r => availableRetailers.includes(r));

    // Render focus retailer chips
    const chipsContainer = document.getElementById("analyticsRetailerChips");
    const focusLabel = document.getElementById("analyticsFocusRetailersLabel");
    if (chipsContainer) {
      chipsContainer.innerHTML = "";
      if (focusLabel) {
        focusLabel.textContent = `FOCUS RETAILERS ${selectedFocusRetailers.length > 0 ? `(${selectedFocusRetailers.length}/3)` : "(all)"}`;
      }
      
      availableRetailers.forEach(name => {
        const selected = selectedFocusRetailers.includes(name);
        const chip = document.createElement("button");
        chip.type = "button";
        chip.style.padding = "4px 12px";
        chip.style.borderRadius = "16px";
        chip.style.fontSize = "11px";
        chip.style.fontWeight = "600";
        chip.style.cursor = "pointer";
        chip.style.transition = "all var(--transition-fast, 0.2s)";
        chip.style.border = "1px solid var(--glass-border)";
        chip.style.backgroundColor = selected ? "var(--brand)" : "rgba(255,255,255,0.01)";
        chip.style.color = selected ? "#ffffff" : "var(--text-secondary)";
        if (selected) {
          chip.style.boxShadow = "0 0 8px var(--brand-glow)";
        }
        chip.textContent = name;
        chip.addEventListener("click", () => {
          if (selectedFocusRetailers.includes(name)) {
            selectedFocusRetailers = selectedFocusRetailers.filter(r => r !== name);
          } else {
            selectedFocusRetailers.push(name);
            if (selectedFocusRetailers.length > 3) {
              selectedFocusRetailers = selectedFocusRetailers.slice(1);
            }
          }
          drawWeeklySpendAnalytics();
        });
        chipsContainer.appendChild(chip);
      });
    }

    // Apply focus retailers filter client side
    const filteredWeeks = weeks.filter(w => selectedFocusRetailers.length === 0 || selectedFocusRetailers.includes(w.storeName));
    const filteredRetailerTotals = retailerTotals.filter(r => selectedFocusRetailers.length === 0 || selectedFocusRetailers.includes(r.storeName));

    const periodTotal = filteredRetailerTotals.reduce((acc, r) => acc + r.totalSpent, 0);

    // Group rows into ISO weeks for stacked bar columns
    const weekBarsMap = {};
    filteredWeeks.forEach(row => {
      if (!weekBarsMap[row.weekLabel]) {
        weekBarsMap[row.weekLabel] = {
          weekLabel: row.weekLabel,
          weekStartDate: row.weekStartDate,
          segments: [],
          total: 0
        };
      }
      weekBarsMap[row.weekLabel].segments.push(row);
      weekBarsMap[row.weekLabel].total += row.totalSpent;
    });

    const weekBars = Object.values(weekBarsMap).sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
    const maxBarTotal = weekBars.reduce((m, b) => Math.max(m, b.total), 0);
    const topRetailer = filteredRetailerTotals[0] ? filteredRetailerTotals[0].storeName : "—";

    // Update KPI UI Elements
    const periodTotalEl = document.getElementById("analyticsPeriodTotal");
    if (periodTotalEl) periodTotalEl.textContent = `€${periodTotal.toFixed(2)}`;

    const weeksTrackedEl = document.getElementById("analyticsWeeksTracked");
    if (weeksTrackedEl) weeksTrackedEl.textContent = weekBars.length;

    const topRetailerEl = document.getElementById("analyticsTopRetailer");
    if (topRetailerEl) topRetailerEl.textContent = topRetailer;

    // RENDER SVG CHART
    const chartWrapper = document.getElementById("analyticsChartWrapper");
    if (chartWrapper) {
      chartWrapper.innerHTML = "";
      if (weekBars.length === 0) {
        chartWrapper.innerHTML = `
          <div class="glass flex-center" style="height: 300px; border-radius: 12px; font-size:14px; color:var(--text-secondary); text-align:center; justify-content:center; display:flex; border: 1px solid var(--glass-border); background: var(--glass-bg);">
            No spending data found for selected filters.
          </div>
        `;
      } else {
        const VB_W = 700;
        const VB_H = 330;
        const PAD_LEFT = 52;
        const PAD_RIGHT = 12;
        const PAD_TOP = 26; 
        const PAD_BOTTOM = 52;
        const plotW = VB_W - PAD_LEFT - PAD_RIGHT;
        const plotH = VB_H - PAD_TOP - PAD_BOTTOM;
        const baseY = PAD_TOP + plotH;
        const yScale = (val) => maxBarTotal > 0 ? (val / maxBarTotal) * plotH : 0;
        const slot = plotW / weekBars.length;
        const barWidth = Math.min(48, slot * 0.62);

        const segmentPath = (x, y, w, h, rTop) => {
          const rr = Math.max(0, Math.min(rTop, h, w / 2));
          return `M ${x} ${y + h} L ${x} ${y + rr} Q ${x} ${y} ${x + rr} ${y} L ${x + w - rr} ${y} Q ${x + w} ${y} ${x + w} ${y + rr} L ${x + w} ${y + h} Z`;
        };

        const compactAmount = (val) => val >= 1000 ? `€${(val / 1000).toFixed(1)}k` : `€${Math.round(val)}`;

        let svgContent = `<svg width="100%" viewBox="0 0 ${VB_W} ${VB_H}" style="overflow:visible; display:block;">`;

        // Y Gridlines
        const gridLines = [0, 0.25, 0.5, 0.75, 1];
        gridLines.forEach(g => {
          const y = baseY - g * plotH;
          const val = maxBarTotal * g;
          svgContent += `
            <line x1="${PAD_LEFT}" y1="${y}" x2="${VB_W - PAD_RIGHT}" y2="${y}" class="chart-grid-line" stroke-dasharray="${g === 0 ? 'none' : '3 3'}" />
            <text x="${PAD_LEFT - 8}" y="${y + 3}" text-anchor="end" class="chart-axis-text" fill="var(--text-secondary)">${compactAmount(val)}</text>
          `;
        });

        // X bars
        weekBars.forEach((bar, i) => {
          const cx = PAD_LEFT + slot * i + slot / 2;
          const x = cx - barWidth / 2;
          let acc = 0;
          const isActiveWeek = bar.weekLabel === selectedAnalyticsWeekLabel;
          const topY = baseY - yScale(bar.total);

          svgContent += `<g data-week="${bar.weekLabel}">`;

          bar.segments.forEach((seg, si) => {
            const h = yScale(seg.totalSpent);
            const y = baseY - acc - h;
            acc += h;
            const color = getRetailerColor(seg.storeName);
            const isTop = si === bar.segments.length - 1;
            const dimmed = hoveredAnalyticsSegment != null && hoveredAnalyticsSegment.storeName !== seg.storeName;

            svgContent += `
              <path d="${segmentPath(x, y, barWidth, Math.max(0.1, h), isTop ? 4 : 0)}" fill="${color}" opacity="${dimmed ? 0.25 : 1}"
                    stroke="${isActiveWeek ? 'var(--text-primary)' : 'none'}" stroke-width="${isActiveWeek ? 1.5 : 0}"
                    class="chart-bar-path" data-store="${seg.storeName}" data-week="${bar.weekLabel}" data-spent="${seg.totalSpent}"
                    style="cursor:pointer; transition: opacity var(--transition-fast, 0.2s);" />
            `;
          });

          // Total label above bar
          if (bar.total > 0) {
            svgContent += `
              <text x="${cx}" y="${topY - 7}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--text-secondary)" opacity="${hoveredAnalyticsSegment ? 0.4 : 1}">${compactAmount(bar.total)}</text>
            `;
          }

          // Week labels
          const weekShort = bar.weekLabel.split("-")[1] || bar.weekLabel;
          const monDate = new Date(bar.weekStartDate + "T00:00:00Z");
          const mondayShort = monDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

          svgContent += `
            <text x="${cx}" y="${baseY + 18}" text-anchor="middle" font-size="9" font-weight="600" fill="${isActiveWeek ? 'var(--brand)' : 'var(--text-secondary)'}">${weekShort}</text>
            <text x="${cx}" y="${baseY + 30}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${mondayShort}</text>
          `;

          svgContent += `</g>`;
        });

        // Baseline
        svgContent += `<line x1="${PAD_LEFT}" y1="${baseY}" x2="${VB_W - PAD_RIGHT}" y2="${baseY}" stroke="var(--glass-border)" stroke-width="1.5" />`;

        // Tooltip
        svgContent += `</svg>
          <div id="analyticsChartTooltip" style="display:none; position:absolute; pointer-events:none; background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:8px; backdrop-filter:blur(12px); box-shadow:var(--card-shadow); padding:8px 12px; z-index:20; white-space:nowrap; left:0; top:0;"></div>
        `;

        chartWrapper.innerHTML = svgContent;

        // Tooltip & hover guides listeners
        const paths = chartWrapper.querySelectorAll(".chart-bar-path");
        const tooltip = chartWrapper.querySelector("#analyticsChartTooltip");

        chartWrapper.addEventListener("mousemove", (e) => {
          const rect = chartWrapper.getBoundingClientRect();
          analyticsTooltipPos.x = e.clientX - rect.left;
          analyticsTooltipPos.y = e.clientY - rect.top;
        });

        paths.forEach(p => {
          p.addEventListener("mouseenter", () => {
            const store = p.dataset.store;
            const week = p.dataset.week;
            const spent = parseFloat(p.dataset.spent);
            const color = getRetailerColor(store);
            const weekShort = week.split("-")[1] || week;

            hoveredAnalyticsSegment = { storeName: store };
            drawWeeklySpendAnalytics(); // Redraws with dimming effect applied

            if (tooltip) {
              tooltip.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="width:10px; height:10px; border-radius:3px; background-color:${color};"></span>
                  <span style="font-weight:600; font-size:12px; color:var(--text-primary);">${store}</span>
                </div>
                <div style="font-size:14px; font-weight:800; margin-top:2px; color:var(--text-primary);">€${spent.toFixed(2)}</div>
                <div style="font-size:10px; color:var(--text-muted);">${weekShort}</div>
              `;
              tooltip.style.left = `${analyticsTooltipPos.x + 15}px`;
              tooltip.style.top = `${analyticsTooltipPos.y + 15}px`;
              tooltip.style.display = "block";
            }
          });

          p.addEventListener("mouseleave", () => {
            hoveredAnalyticsSegment = null;
            drawWeeklySpendAnalytics();
            if (tooltip) tooltip.style.display = "none";
          });

          p.addEventListener("click", () => {
            const week = p.dataset.week;
            selectedAnalyticsWeekLabel = selectedAnalyticsWeekLabel === week ? null : week;
            drawWeeklySpendAnalytics();
          });
        });
      }
    }

    // RENDER LEGEND
    const legendContainer = document.getElementById("analyticsLegend");
    if (legendContainer) {
      legendContainer.innerHTML = "";
      filteredRetailerTotals.forEach(r => {
        const color = getRetailerColor(r.storeName);
        const dimmed = hoveredAnalyticsSegment != null && hoveredAnalyticsSegment.storeName !== r.storeName;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.gap = "6px";
        btn.style.background = "none";
        btn.style.border = "none";
        btn.style.padding = 0;
        btn.style.cursor = "pointer";
        btn.style.opacity = dimmed ? 0.4 : 1;
        btn.style.transition = "opacity var(--transition-fast, 0.2s)";

        btn.innerHTML = `
          <span style="width:10px; height:10px; border-radius:3px; background-color:${color};"></span>
          <span style="font-size:11px; color:var(--text-secondary); font-weight:600;">${r.storeName}</span>
        `;

        btn.addEventListener("mouseenter", () => {
          hoveredAnalyticsSegment = { storeName: r.storeName };
          drawWeeklySpendAnalytics();
        });

        btn.addEventListener("mouseleave", () => {
          hoveredAnalyticsSegment = null;
          drawWeeklySpendAnalytics();
        });

        legendContainer.appendChild(btn);
      });
    }

    // RENDER WEEK DRILL-DOWN CARD
    const drilldownCard = document.getElementById("analyticsDrilldownCard");
    if (drilldownCard) {
      if (selectedAnalyticsWeekLabel) {
        const bar = weekBars.find(b => b.weekLabel === selectedAnalyticsWeekLabel);
        if (bar) {
          const weekShort = bar.weekLabel.split("-")[1] || bar.weekLabel;
          const monDate = new Date(bar.weekStartDate + "T00:00:00Z");
          const mondayShort = monDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

          let rowsHtml = "";
          bar.segments.forEach(seg => {
            const color = getRetailerColor(seg.storeName);
            rowsHtml += `
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                  <span style="width:12px; height:12px; border-radius:4px; background-color:${color}; flex-shrink:0;"></span>
                  <span style="font-size:13px; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${seg.storeName}</span>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
                  <span class="muted-text" style="font-size:11px; color:var(--text-secondary);">${seg.invoiceCount} invoice${seg.invoiceCount === 1 ? '' : 's'}</span>
                  <span style="font-weight:700; font-size:14px; color:var(--text-primary);">€${seg.totalSpent.toFixed(2)}</span>
                </div>
              </div>
            `;
          });

          drilldownCard.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:12px; border-bottom:1px solid var(--glass-border); margin-bottom:12px;">
              <span style="font-weight:600; font-size:14px; color:var(--text-primary); font-family: var(--font-display);">${weekShort} · ${mondayShort}</span>
              <span style="font-weight:700; font-size:15px; color:var(--brand);">€${bar.total.toFixed(2)}</span>
            </div>
            <div style="display:flex; flex-direction:column;">
              ${rowsHtml}
            </div>
          `;
          drilldownCard.style.display = "block";
        } else {
          drilldownCard.style.display = "none";
        }
      } else {
        drilldownCard.style.display = "none";
      }
    }

    // RENDER TOP RETAILERS LIST (RIGHT PANEL)
    const retailersListContainer = document.getElementById("analyticsTopRetailersList");
    if (retailersListContainer) {
      retailersListContainer.innerHTML = "";
      if (filteredRetailerTotals.length === 0) {
        retailersListContainer.innerHTML = `<p style="font-size:13px; color:var(--text-secondary); text-align:center;">No retailers found.</p>`;
      } else {
        filteredRetailerTotals.forEach(r => {
          const pct = periodTotal > 0 ? (r.totalSpent / periodTotal) * 100 : 0;
          const color = getRetailerColor(r.storeName);

          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.flexDirection = "column";
          row.style.gap = "8px";
          row.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
                <span style="width:12px; height:12px; border-radius:4px; background-color:${color}; flex-shrink:0;"></span>
                <span style="font-weight:600; font-size:14px; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.storeName}</span>
              </div>
              <div style="text-align:right; flex-shrink:0;">
                <div style="font-weight:700; font-size:15px; color:var(--text-primary);">€${r.totalSpent.toFixed(2)}</div>
                <div class="muted-text" style="font-size:11px; margin-top:2px; color:var(--text-secondary);">(${pct.toFixed(1)}%)</div>
              </div>
            </div>
            <div style="width:100%; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
              <div style="width:${pct}%; height:100%; background-color:${color}; border-radius:4px; box-shadow:0 0 6px ${color}80;"></div>
            </div>
          `;
          retailersListContainer.appendChild(row);
        });
      }
    }
  }

  function initWeeklySpendAnalyticsEvents() {
    const segmentBtns = document.querySelectorAll("#analyticsSegmentControl .segment-btn");
    segmentBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        segmentBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedFocusRetailers = [];
        selectedAnalyticsWeekLabel = null;
        drawWeeklySpendAnalytics();
      });
    });

    const presetBtns = document.querySelectorAll("#analyticsPresetControl .segment-btn");
    const fromInput = document.getElementById("analyticsFromDate");
    const toInput = document.getElementById("analyticsToDate");

    function updateInputs(from, to) {
      if (fromInput) fromInput.value = from;
      if (toInput) toInput.value = to;
    }

    // Set initial dates matching active preset
    const range = rangeForPresetAnalytics("last-2-weeks");
    updateInputs(range.from, range.to);

    presetBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        presetBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const range = rangeForPresetAnalytics(btn.dataset.preset);
        updateInputs(range.from, range.to);
        selectedFocusRetailers = [];
        selectedAnalyticsWeekLabel = null;
        drawWeeklySpendAnalytics();
      });
    });

    if (fromInput) {
      fromInput.addEventListener("change", () => {
        presetBtns.forEach(b => b.classList.remove("active"));
        selectedFocusRetailers = [];
        selectedAnalyticsWeekLabel = null;
        drawWeeklySpendAnalytics();
      });
    }
    if (toInput) {
      toInput.addEventListener("change", () => {
        presetBtns.forEach(b => b.classList.remove("active"));
        selectedFocusRetailers = [];
        selectedAnalyticsWeekLabel = null;
        drawWeeklySpendAnalytics();
      });
    }
  }

  // ==========================================
  // Shopping List Sharing Dialog Preview
  // ==========================================
  function openShareListPopover() {
    const text = generateShareText();
    const previewBody = document.getElementById("sharePreviewBodyText");
    if (previewBody) {
      previewBody.textContent = text;
    }
    
    const previewCard = document.getElementById("sharePreviewCard");
    if (previewCard) previewCard.style.display = "none";
    document.getElementById("sharePopoverOverlay").classList.add("active");
  }

  function generateShareText() {
    let cheapestStore = "";
    let cheapestCost = Infinity;
    let mostExpensiveStore = "";
    let mostExpensiveCost = -Infinity;

    listStores.forEach(store => {
      let total = 0;
      currentShoppingList.forEach(item => {
        const prices = storePrices[item.name];
        const unitPrice = prices ? prices[store.key] : 1.99;
        total += unitPrice * item.qty;
      });

      if (total < cheapestCost) {
        cheapestCost = total;
        cheapestStore = store.name;
      }
      if (total > mostExpensiveCost) {
        mostExpensiveCost = total;
        mostExpensiveStore = store.name;
      }
    });

    const difference = mostExpensiveCost - cheapestCost;

    let text = `🛒 MY GROCERY LIST (Wobblio)\n\n`;
    currentShoppingList.forEach(item => {
      text += `- ${item.qty}x ${item.name}\n`;
    });

    if (difference > 0 && currentShoppingList.length > 0) {
      text += `\n💡 Savings Recommendation:\n`;
      text += `Buy at ${cheapestStore} for an estimated total of €${cheapestCost.toFixed(2)}. (Saves €${difference.toFixed(2)} compared to ${mostExpensiveStore}!)\n`;
    }
    text += `\nShared via Wobblio App.`;
    return text;
  }

  function copyShareTextToClipboard() {
    const text = generateShareText();
    navigator.clipboard.writeText(text).then(() => {
      const previewCard = document.getElementById("sharePreviewCard");
      if (previewCard) previewCard.style.display = "block";
      const successMsg = document.getElementById("shareSuccessMsg");
      if (successMsg) successMsg.textContent = "Copied to clipboard!";
      alert("List text successfully copied!");
    }).catch(err => {
      alert("Clipboard copy failed.");
    });
  }

  // Parity Upgrades Initial runs
  initSpendingBreakdownEvents();
  initWeeklySpendAnalyticsEvents();
  
  // Bind Share modal close / whatsapp buttons
  const listShareBtn = document.getElementById("listShareBtn");
  if (listShareBtn) listShareBtn.addEventListener("click", openShareListPopover);

  const shareCloseBtn = document.getElementById("shareCloseBtn");
  if (shareCloseBtn) shareCloseBtn.addEventListener("click", () => {
    document.getElementById("sharePopoverOverlay").classList.remove("active");
  });

  const shareCopyBtn = document.getElementById("shareCopyBtn");
  if (shareCopyBtn) shareCopyBtn.addEventListener("click", copyShareTextToClipboard);

  const shareWhatsappBtn = document.getElementById("shareWhatsappBtn");
  if (shareWhatsappBtn) {
    shareWhatsappBtn.addEventListener("click", () => {
      const text = generateShareText();
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    });
  }

  // Switch to dashboard view inside workspace initially
  switchWorkspacePane("dashboard");

});
