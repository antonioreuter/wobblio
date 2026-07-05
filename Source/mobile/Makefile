# Wobblio mobile — build / validate / deploy helper.
# Configure devices + dart-defines in `mobile.config` (not this file). `make help`.

-include mobile.config

# Fallback defaults if mobile.config is missing or a value is unset.
FLUTTER              ?= fvm flutter
ANDROID_EMULATOR_ID  ?= emulator-5554
IOS_SIMULATOR_ID     ?= booted
PHYSICAL_DEVICE_ID   ?=
ANDROID_AVD          ?=
IOS_SIMULATOR_NAME   ?= iPhone 15
BUILD_MODE           ?= debug

# Runtime config passed to every build/run.
DART_DEFINES = \
	--dart-define=API_BASE_URL=$(API_BASE_URL) \
	--dart-define=COGNITO_CLIENT_ID=$(COGNITO_CLIENT_ID) \
	--dart-define=COGNITO_DOMAIN=$(COGNITO_DOMAIN)

.DEFAULT_GOAL := help

# ── Meta ─────────────────────────────────────────────────────────────────────
.PHONY: help
help: ## Show this help
	@echo "Wobblio mobile — configure devices in mobile.config, then:"
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-18s\033[0m %s\n",$$1,$$2}'

.PHONY: doctor
doctor: ## flutter doctor (toolchain health)
	$(FLUTTER) doctor

.PHONY: devices
devices: ## List connected devices/emulators + their ids
	$(FLUTTER) devices

.PHONY: emulators
emulators: ## List available emulators/simulators (AVD/sim names)
	$(FLUTTER) emulators

# ── Build hygiene / validation ───────────────────────────────────────────────
.PHONY: deps
deps: ## Fetch pub dependencies
	$(FLUTTER) pub get

.PHONY: format
format: ## Format Dart sources in place
	dart format lib test

.PHONY: analyze
analyze: ## Static analysis (flutter analyze)
	$(FLUTTER) analyze

.PHONY: test
test: ## Run unit + widget tests
	$(FLUTTER) test

.PHONY: validate
validate: deps ## Validate: format check + analyze + tests (CI-style, no writes)
	dart format --output=none --set-exit-if-changed lib test
	$(FLUTTER) analyze
	$(FLUTTER) test

.PHONY: clean
clean: ## flutter clean
	$(FLUTTER) clean

# ── Build artifacts ──────────────────────────────────────────────────────────
.PHONY: build-android
build-android: ## Build the Android APK (mode = BUILD_MODE)
	$(FLUTTER) build apk --$(BUILD_MODE) $(DART_DEFINES)

.PHONY: build-ios
build-ios: ## Build the iOS app, unsigned (mode = BUILD_MODE)
	$(FLUTTER) build ios --$(BUILD_MODE) --no-codesign $(DART_DEFINES)

.PHONY: build
build: build-android build-ios ## Build both Android + iOS artifacts

# ── Run on emulators (attached: hot reload; press q to stop) ─────────────────
.PHONY: run-android
run-android: ## Build+install+launch on the Android emulator (attached)
	$(FLUTTER) run -d $(ANDROID_EMULATOR_ID) $(DART_DEFINES)

.PHONY: run-ios
run-ios: ## Build+install+launch on the iOS simulator (attached)
	$(FLUTTER) run -d $(IOS_SIMULATOR_ID) $(DART_DEFINES)

# ── Deploy = install without staying attached ────────────────────────────────
.PHONY: deploy-android
deploy-android: build-android ## Build APK then install it on the Android emulator
	$(FLUTTER) install -d $(ANDROID_EMULATOR_ID)

.PHONY: deploy-ios
deploy-ios: build-ios ## Build then install on the iOS simulator
	$(FLUTTER) install -d $(IOS_SIMULATOR_ID)

.PHONY: deploy
deploy: deploy-android deploy-ios ## Deploy to both emulators

# ── Boot an emulator/simulator that isn't running ────────────────────────────
.PHONY: start-android
start-android: ## Launch the Android AVD named in ANDROID_AVD
	@if [ -z "$(ANDROID_AVD)" ]; then \
		echo "Set ANDROID_AVD in mobile.config (see: make emulators)"; exit 1; fi
	$(FLUTTER) emulators --launch $(ANDROID_AVD)

.PHONY: start-ios
start-ios: ## Open the iOS Simulator and boot IOS_SIMULATOR_NAME
	open -a Simulator
	-xcrun simctl boot "$(IOS_SIMULATOR_NAME)"

# ── Physical phone (Android or iOS) ──────────────────────────────────────────
.PHONY: install-device
install-device: ## Install + run on the physical phone (release) in PHYSICAL_DEVICE_ID
	@if [ -z "$(PHYSICAL_DEVICE_ID)" ]; then \
		echo "Set PHYSICAL_DEVICE_ID in mobile.config (plug in the phone, then: make devices)"; exit 1; fi
	$(FLUTTER) run -d $(PHYSICAL_DEVICE_ID) --release $(DART_DEFINES)
