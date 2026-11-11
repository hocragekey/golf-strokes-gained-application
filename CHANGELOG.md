# Changelog

## [0.2.0](https://github.com/hocragekey/golf-strokes-gained-application/compare/v0.1.0...v0.2.0) (2026-11-11)


### ⚠ BREAKING CHANGES

* **api:** remove unauthenticated course/round/stats endpoints

### Features

* add scratch baseline and a per-device baseline selector ([a035cd2](https://github.com/hocragekey/golf-strokes-gained-application/commit/a035cd27bcaa56dab6099660af79402cbbfbc198))
* Google sign-in with local-first sync to a per-user AWS API ([83dfbd5](https://github.com/hocragekey/golf-strokes-gained-application/commit/83dfbd5ffd33bc16f293ff70999f7e798915dbf4))
* **infra:** add AWS dev/prod hosting with CloudFormation and OIDC deploys ([743f8e4](https://github.com/hocragekey/golf-strokes-gained-application/commit/743f8e4d8d4df0e85d32e4ad4540e111f34684d2))
* **infra:** add AWS dev/prod hosting with CloudFormation and OIDC deploys ([094252d](https://github.com/hocragekey/golf-strokes-gained-application/commit/094252d390c2129d508aab561e2e3a32a0518ccc))
* **infra:** add one-command AWS and GitHub bootstrap script ([0e38224](https://github.com/hocragekey/golf-strokes-gained-application/commit/0e3822444857c4443b806a6e47289c8f29493ec8))
* **infra:** sync API stack, artifact bucket, same-origin /api behavior and deploy steps ([71e2cb4](https://github.com/hocragekey/golf-strokes-gained-application/commit/71e2cb4151f2c963b37d13392941a6caa8e4a378))
* offline-first golf strokes-gained PWA with CI/CD and repo standards ([527e1cb](https://github.com/hocragekey/golf-strokes-gained-application/commit/527e1cb1f32617ffd2805c1db43c05b853fa536e))
* offline-first golf strokes-gained PWA with CI/CD and repo standards ([d46a7e4](https://github.com/hocragekey/golf-strokes-gained-application/commit/d46a7e4c42bf122ef3319720d3ceb2f60750abbc))
* PRD and technical design, scratch baseline, scorecard-agnostic card guide, AWS bootstrap script ([46637c1](https://github.com/hocragekey/golf-strokes-gained-application/commit/46637c1b89dbf23fd66b2fd3346e28d3ca3bc1ca))
* **shared:** sync protocol schemas, validation and last-writer-wins helpers ([b94b52f](https://github.com/hocragekey/golf-strokes-gained-application/commit/b94b52f16e7462abbb06b2d50902d75a83c3d721))
* **site:** add marketing and architecture page published to GitHub Pages ([ddbbd18](https://github.com/hocragekey/golf-strokes-gained-application/commit/ddbbd18d7302d270f4d80dc6b7e94c04f88e938b))
* **site:** add marketing and architecture page published to GitHub Pages ([61306bd](https://github.com/hocragekey/golf-strokes-gained-application/commit/61306bd9b05302e7a53d99783ac6e34d931ade30))
* **site:** add marketing and architecture page published to GitHub Pages ([4ec7293](https://github.com/hocragekey/golf-strokes-gained-application/commit/4ec729357e3549d25147070689888eb22ef9122d))
* **sync:** authenticated per-user sync API handler with DynamoDB repository ([9dd4d2c](https://github.com/hocragekey/golf-strokes-gained-application/commit/9dd4d2c3cbfe6d1b8055a4af7f8a54f4d9b362f6))
* **web:** add Google sign-in, account page and background sync engine ([72fdd07](https://github.com/hocragekey/golf-strokes-gained-application/commit/72fdd070f36af30a9a9ff0fa36a6c8da7c13b1ca))
* **web:** kelly green theme, new logo, invisible sync; rename tee column to drive ([582e7d6](https://github.com/hocragekey/golf-strokes-gained-application/commit/582e7d60fc77902817da66175c2cfb455751eb2b))
* **web:** light kelly green and silver theme with square corners; rename tee column to drive ([4c08cc3](https://github.com/hocragekey/golf-strokes-gained-application/commit/4c08cc39ebb37381414b85f96ddc4e9779e6b8ed))
* **web:** make storage and sync invisible; remove data download and offline badge ([0dc65bf](https://github.com/hocragekey/golf-strokes-gained-application/commit/0dc65bfbd20f579a128e1e5b666c83520a8cd64d))
* **web:** new logo with rising bars, ball and pin ([45b39d2](https://github.com/hocragekey/golf-strokes-gained-application/commit/45b39d288f5f66e5bb22c1ae9d8ab87aa3cbc408))
* **web:** remove saved courses and backup import, keep a download-my-data export ([d28ba4a](https://github.com/hocragekey/golf-strokes-gained-application/commit/d28ba4a240a280126cf6bb9da790da92fbca9587))
* **web:** round-first guided entry, course-photo home, practice-first results ([55468fb](https://github.com/hocragekey/golf-strokes-gained-application/commit/55468fb5631172ee7fe64a6e144c198dc466c2b2))
* **web:** round-first guided entry, course-photo home, practice-first results ([76fc724](https://github.com/hocragekey/golf-strokes-gained-application/commit/76fc724d13e5a33ed22e1e52271ee160a09bd24b))
* **web:** scorecard-agnostic hole notation and printable pocket sheet with QR code ([6d8bd29](https://github.com/hocragekey/golf-strokes-gained-application/commit/6d8bd29aabeae221dc924d8770e7d02b2daed990))


### Bug Fixes

* **ci:** acknowledge named iam role when deploying the sync api stack ([8f1ce80](https://github.com/hocragekey/golf-strokes-gained-application/commit/8f1ce80824cf098c53e04384f36d897165dd260c))
* **ci:** acknowledge named IAM role when deploying the sync API stack ([2a2f62f](https://github.com/hocragekey/golf-strokes-gained-application/commit/2a2f62f2f03148e1cf6be4b162ca34aff06ff2c8))
* **ci:** drop empty inputs key that made the release workflow invalid ([7424b11](https://github.com/hocragekey/golf-strokes-gained-application/commit/7424b110ee3c726b50fd9298fb8031ed083a0800))
* **ci:** drop empty inputs key that made the release workflow invalid ([fda7132](https://github.com/hocragekey/golf-strokes-gained-application/commit/fda71324da04dfb14a5cfb546864c12ad9505037))
* ignore inherited object keys when resolving baseline ids ([64419b5](https://github.com/hocragekey/golf-strokes-gained-application/commit/64419b595ae388baa287e315e196be37ca4b59f6))
* **infra:** accept the test environment in the web and api stacks ([bd8c170](https://github.com/hocragekey/golf-strokes-gained-application/commit/bd8c170db9fefd42c0249ca1aaa117b791d74312))
* **infra:** allow deploy roles to describe and execute their change sets ([3c56b28](https://github.com/hocragekey/golf-strokes-gained-application/commit/3c56b288cf8820f9aaf548431ccfca4dde3a4f1a))
* **infra:** allow tagging api gateway stages and drop the table on a failed create ([da02a76](https://github.com/hocragekey/golf-strokes-gained-application/commit/da02a7635b18068358e3099cff09bcb4269e08b1))
* **infra:** allow tagging api gateway stages so the sync api stack can deploy ([12432b0](https://github.com/hocragekey/golf-strokes-gained-application/commit/12432b0121f8d4875685774e5e83267aacb12674))
* **infra:** split the CloudFormation execution role per environment ([8c43263](https://github.com/hocragekey/golf-strokes-gained-application/commit/8c43263ca8ff83b8d217e3a55b5f46367d5d6e2d))
* **infra:** trust GitHub's immutable OIDC subject in deploy roles ([668a45b](https://github.com/hocragekey/golf-strokes-gained-application/commit/668a45b1084899a47bf5cab41d3201c6fb31c3b1))
* **infra:** trust GitHub's immutable OIDC subject in deploy roles ([9f7b3f7](https://github.com/hocragekey/golf-strokes-gained-application/commit/9f7b3f7ffc45dfe19e96c15c8ea4e39d8bcb1a82))
* **scripts:** keep existing prod reviewers and default to the gh user ([d88662b](https://github.com/hocragekey/golf-strokes-gained-application/commit/d88662bf1637427def28c3d68770459a7a3690ea))
* **scripts:** pass repo IDs when GitHub issues immutable OIDC subjects ([7180de5](https://github.com/hocragekey/golf-strokes-gained-application/commit/7180de5458a18530b7a08f9b4abc68355433f45c))
* **scripts:** stop if the OIDC subject format can't be read ([a26c675](https://github.com/hocragekey/golf-strokes-gained-application/commit/a26c6750daee46d37d87c318bb8b111ddf1b00d8))
* **shared:** reject GIR when the green was not reached in regulation ([053cc60](https://github.com/hocragekey/golf-strokes-gained-application/commit/053cc60e6329a201dfaf473c3d949cf29ef8d37b))
* track web data layer ignored by overly broad data/ pattern ([403fca9](https://github.com/hocragekey/golf-strokes-gained-application/commit/403fca952bb228d0f02f5fd796a5b2889ceb72b8))
* **web:** clear leftovers marker when the same account signs back in ([e807e95](https://github.com/hocragekey/golf-strokes-gained-application/commit/e807e950dc4c40c2396f6e82a55bcb3e2132ab32))
* **web:** clear prefilled yardages when switching to unsaved tees ([721d69a](https://github.com/hocragekey/golf-strokes-gained-application/commit/721d69a0f451631ff2eed18ab11ff857166f0111))
* **web:** default new rounds to the local date ([cace28c](https://github.com/hocragekey/golf-strokes-gained-application/commit/cace28c28377f0aa46e44fa7f0bf34719345fab2))
* **web:** default short-game lie to fairway when none is entered ([dd25a60](https://github.com/hocragekey/golf-strokes-gained-application/commit/dd25a60723309d9a9ac19bb359fc256c9c942a6c))
* **web:** keep newly typed tees instead of reverting to saved tees ([c2f1c19](https://github.com/hocragekey/golf-strokes-gained-application/commit/c2f1c199e3c05c9887da2ea76b8c8878cd6d5ca4))
* **web:** keep partial saved-course layouts and allow editing them ([9dd0909](https://github.com/hocragekey/golf-strokes-gained-application/commit/9dd090920614330a75015695488ab3cd50f55018))
* **web:** keep results on screen while changing range or baseline ([d12a82c](https://github.com/hocragekey/golf-strokes-gained-application/commit/d12a82cbe9df4aee8f2ac38037ee50588df4ddf1))
* **web:** keep results on screen while changing range or baseline ([f1db616](https://github.com/hocragekey/golf-strokes-gained-application/commit/f1db616677a355a96a3c50230c402a4dfaeab506))
* **web:** keep rounds consistent with course edits, concurrent deletes and backups ([67a303e](https://github.com/hocragekey/golf-strokes-gained-application/commit/67a303ebc612ad00ae9293dab216672b20faeafa))
* **web:** keep selected choices readable on hover ([09d09f6](https://github.com/hocragekey/golf-strokes-gained-application/commit/09d09f69d4a060e6cb2e3f657fbbb9b1fbae3cd8))
* **web:** keep unsent changes on sign-out, switch tokens after adopt, retry same-round edits ([7758c67](https://github.com/hocragekey/golf-strokes-gained-application/commit/7758c67495024fc558e3009a5633bf1deef41d91))
* **web:** let guided questions accept any valid count via an Other box ([6813941](https://github.com/hocragekey/golf-strokes-gained-application/commit/6813941c7ebab60c2c5d604bcd84123098fd2b17))
* **web:** re-pull after partial sign-out; keep signed-out rounds on account switch ([9e96f6f](https://github.com/hocragekey/golf-strokes-gained-application/commit/9e96f6f58f49d4f1a1c93f5254869d0486bf7a89))
* **web:** re-pull after partial sign-out; keep signed-out rounds on account switch ([925a8c2](https://github.com/hocragekey/golf-strokes-gained-application/commit/925a8c2f0b2a9fefe50a37dfa005b2720e140844))
* **web:** redirect the old /backup link to /data ([2d57b8f](https://github.com/hocragekey/golf-strokes-gained-application/commit/2d57b8f16b777538afefe8f8399f238e1ad70bb6))
* **web:** reject backups with misnumbered holes or layout ([5b11820](https://github.com/hocragekey/golf-strokes-gained-application/commit/5b11820d2dc47762748bd176bc03059b753b0d5c))
* **web:** reset an invalid Other answer to the saved value ([4d80afa](https://github.com/hocragekey/golf-strokes-gained-application/commit/4d80afaf71361559df78a48d89cc4d25c6abaa4b))
* **web:** sign-out keeps only unsent rounds; retry failed syncs while open ([0c31564](https://github.com/hocragekey/golf-strokes-gained-application/commit/0c315641bfdc6c055988d619947406ac49ee5f79))
* **web:** sign-out keeps only unsent rounds; retry failed syncs while open ([8fc82f9](https://github.com/hocragekey/golf-strokes-gained-application/commit/8fc82f9b18489ce29d1475ac0f3c8dcd65b93f2f))
* **web:** size bottom-nav tabs to their labels so none truncate ([0de80fd](https://github.com/hocragekey/golf-strokes-gained-application/commit/0de80fd88b75535b581f49621aa7f685a2da37af))
* **web:** skip off-the-tee when picking the practice focus for par-3-only rounds ([6f785d6](https://github.com/hocragekey/golf-strokes-gained-application/commit/6f785d6dfe64af7da7a98c51c339df01414d541d))
* **web:** truncate long bottom-nav labels instead of overflowing on phones ([e88c15d](https://github.com/hocragekey/golf-strokes-gained-application/commit/e88c15dd6e0fb781cf43bb3e3ae3e2805c3ef03c))


### Code Refactoring

* **api:** remove unauthenticated course/round/stats endpoints ([9f7c4fc](https://github.com/hocragekey/golf-strokes-gained-application/commit/9f7c4fca58e59eabeff9fc70552ff5cf526eed33))
