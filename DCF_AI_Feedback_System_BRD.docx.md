  
**COMMONWEALTH OF MASSACHUSETTS**

Department of Children and Families

**BUSINESS REQUIREMENTS DOCUMENT**

**AI-Assisted Centralized Feedback System**

Integrated with iFamilyNet & MicroApps Platform

| Document Version | 1.0 — Draft |
| :---- | :---- |
| **Prepared For** | DCF (Dept. of Children & Families) |
| **Prepared By** | InApp — HHS Practice |
| **Date** | May 2026 |
| **Status** | For Review |
| **Classification** | Confidential |

# **1\. Executive Summary**

The Department of Children & Families (DCF) requires an AI-Assisted Centralized Feedback System — a single, role-segregated platform embedded within the DCF Partner Portal and the iFamilyNet ecosystem. The system will systematically collect, aggregate, and surface actionable feedback from four distinct user groups: Mandated Reporters, Volunteers, Attorneys, and Foster Parents.

Artificial Intelligence is not an optional add-on to this system; it is the engine that makes the platform's promise achievable at scale. Without AI, a centralized feedback platform is essentially a large inbox — useful for collecting complaints but incapable of surfacing actionable insights from thousands of free-text submissions across dozens of area offices. With AI, the same platform becomes a real-time intelligence system: automatically categorizing submissions, detecting emerging patterns, flagging urgent cases, summarizing themes for leadership, and closing the loop with submitters — all while preserving human judgment at every decision point.

| The Core Value Proposition: AI transforms the feedback system from a passive data collection tool into an active quality improvement engine. It processes what humans cannot process at scale, surfaces what humans might overlook in volume, and responds at a speed that keeps submitters engaged — all while preserving human judgment at every decision point. |
| :---- |

| Without AI | With AI |
| :---- | :---- |
| Manual review of every submission | Automated classification and routing on ingestion |
| Themes identified months after the fact | Real-time trend detection and anomaly alerts |
| Satisfaction data sits in spreadsheets | Live dashboards per area office and user group |
| No response to most submitters | Automated acknowledgement and status updates |
| Training gaps identified by managers | AI surfaces training needs from feedback patterns |
| CFSR evidence gathered manually | Quarterly reports auto-generated from feedback corpus |

# **2\. Business Objectives**

* Establish a single source of truth for service quality feedback across all DCF programme areas.

* Provide measurable, quantitative insight into intake quality, placement quality, legal process adherence, and volunteer programme effectiveness.

* Enable DCF leadership to monitor trends, identify service gaps, and drive corrective action through real-time AI-powered dashboards.

* Reduce manual feedback collection effort by automating survey triggers based on system events in iFamilyNet.

* Deploy AI-driven NLP to auto-classify, score, and route every submission — eliminating manual review bottlenecks.

* Support compliance and audit requirements by maintaining a structured, time-stamped record of stakeholder feedback.

* Leverage predictive analytics to forecast placement instability, volunteer attrition, and CFSR compliance gaps before they materialise.

# **3\. Scope**

## **3.1  In Scope**

* DCF Partner Portal: four role-restricted sections (Mandated Reporters, Volunteers, Attorneys, Foster Parents).

* Automated survey triggers integrated with iFamilyNet event data (51A filing, case milestones, placement records).

* AI-powered NLP pipeline: topic classification, sentiment scoring, urgency detection, named entity recognition.

* Predictive analytics models: placement stability prediction, volunteer retention, CFSR outcome forecasting.

* Generative AI reporting: automated weekly briefs, monthly division reports, and quarterly CFSR evidence packages.

* Administrative dashboard for DCF staff to view, filter, export, and act on aggregated feedback.

* Equity and bias monitoring: demographic disaggregation of all feedback metrics with DEI routing.

* Audit trail and data-retention policies aligned with DCF compliance standards.

## **3.2  Out of Scope**

* Modifications to the core iFamilyNet application outside feedback-event hooks.

* Public-facing feedback channels (e.g., social media, general public surveys).

* Integration with third-party CRM or analytics platforms (deferred to Phase 2).

* Any AI output that triggers automated consequences without human review.

# **4\. Stakeholders**

| Stakeholder Group | Role / Interest | Engagement Level |
| :---- | :---- | :---- |
| **DCF Leadership** | Sponsor; receives aggregated AI quality metrics and generative reports | Decision-maker |
| **Caseworker Supervisors** | Act on intake & placement feedback; receive AI-generated alerts; manage corrective workflows | Primary user |
| **Mandated Reporters** | External; rates intake quality post-51A filing; receives AI acknowledgements | Feedback provider |
| **Volunteers** | Internal; rates training & support; AI models predict engagement lifecycle | Feedback provider |
| **Attorneys** | External; rates legal process adherence; privilege-tagged submissions | Feedback provider |
| **Foster Parents** | External; rates placement & caseworker quality; AI longitudinal tracking | Feedback provider |
| **InApp Development** | System builder; AI layer and MicroApp integration owner | Technical owner |
| **DCF IT / Compliance** | Security, data governance, AI governance, audit compliance | Approver |
| **DCF DEI Office** | Receives equity monitoring alerts and demographic disparity flags | Approver |

# **5\. Intake Process & Feedback Trigger Points**

| Intake Process Overview1. Reporter contacts DCF Hotline → Intake Screener logs call in iFamilyNet2. Screener assesses report → 51A (Accepted for Investigation) or 51B (Not Accepted) filed3. If 51A: Case opened, caseworker assigned, investigation begins4. Placement decision made (if required) → Foster parent matched via iFamilyNet5. Case progresses: legal filings, service plan development, attorney reviews6. Case closure / ongoing monitoringFeedback triggers fire automatically at Steps 2, 4, 5, and 6\. AI classification and urgency detection begin immediately upon submission. |
| :---- |

| Trigger Event | User Group | Timing | Feedback Method | Key Domains | AI Layer |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 51A Filed | Mandated Reporter | 5–7 days post-filing | Auto-triggered survey | Hotline, screener quality, notification | NLP classification; notification compliance check |
| Training / Volunteer Event | Volunteer | Within 48 hrs | Event-triggered pulse | Training quality, resource gaps | Engagement lifecycle model; gap map update |
| Document / Service Plan Due | Attorney | On milestone date | Structured milestone form | Timeliness, completeness, adherence | Privilege tagging; compliance heatmap |
| Placement Milestone (30/60/90d) | Foster Parent | At 30/60/90 days | Longitudinal survey | Visit quality, support, stipends | Longitudinal profile; stability prediction |
| Case Closure | Foster Parent / Attorney | Within 7 days | Case closure survey | Outcome satisfaction, process adherence | Generative summary; CFSR evidence update |

# **6\. Functional Requirements by User Group**

## **6.1  Mandated Reporters**

Mandated Reporters are the highest-volume feedback group and the Phase 1 launch cohort. AI automatically triggers surveys, classifies submissions, tracks notification compliance, and benchmarks screener performance by reporter category.

| ID | Requirement | Priority | Notes |
| :---- | :---- | :---- | :---- |
| **MR-01** | System shall automatically trigger a post-report survey in iFamilyNet 5–7 business days after a 51A is filed. | **Must Have** | Event hook on 51A status change |
| **MR-02** | Survey shall include quantitative rating scales (1–5) for: hotline wait time, screener professionalism, clarity of next steps, and outcome notification timeliness. | **Must Have** | Standardised Likert scale |
| **MR-03** | System shall support one optional free-text comment field per survey (max 500 characters), processed by NLP pipeline on submission. | **Should Have** | NLP auto-classifies free-text |
| **MR-04** | Survey link shall be sent via secure email notification to the reporter's registered email in iFamilyNet. | **Must Have** | Tokenised, single-use link |
| **MR-05** | System shall enforce a single response per 51A filing per reporter (no duplicate submissions). | **Must Have** | Token invalidation on submit |
| **MR-06** | Survey shall expire and become unavailable 14 days after dispatch. | **Should Have** | Configurable by admin |
| **MR-07** | All responses shall be anonymised in the reporting dashboard; no PII linkage to individual reporters. | **Must Have** | HIPAA / DCF data policy |
| **MR-08** | AI shall cross-reference reporter-reported notification outcomes against DCF's documented notification records and automatically flag compliance gaps. | **Must Have** | Notification compliance tracking |
| **MR-09** | AI shall segment and benchmark feedback by reporter category (educator, healthcare, law enforcement) for targeted training insights. | **Should Have** | Reporter category benchmarking |

## **6.2  Volunteers**

Volunteers provide internal feedback on training quality, staff support, and community resource gaps. AI engagement lifecycle modeling and community resource gap mapping are core deliverables for this group.

| ID | Requirement | Priority | Notes |
| :---- | :---- | :---- | :---- |
| **VOL-01** | System shall support both scheduled periodic pulse surveys (configurable cadence: weekly/monthly) and event-triggered surveys post-training or community event. | **Must Have** | Admin-configurable schedule |
| **VOL-02** | Event-triggered surveys shall fire within 48 hours of a volunteer event being marked 'Completed' in iFamilyNet. | **Must Have** | Event hook on volunteer activity |
| **VOL-03** | Survey domains shall include: training content quality, facilitator effectiveness, resource availability, staff responsiveness, and community resource adequacy. | **Must Have** | Domain list reviewed with DCF |
| **VOL-04** | System shall allow volunteers to flag resource gaps as high-priority, routing flagged items to the supervisor dashboard. | **Should Have** | Flag \= priority queue item |
| **VOL-05** | Volunteers shall be able to access and submit surveys via mobile-responsive portal. | **Must Have** | Mobile viewport support |
| **VOL-06** | System shall track participation rates by volunteer cohort and surface low-engagement alerts to administrators. | **Should Have** | Threshold configurable by admin |
| **VOL-07** | AI shall cluster volunteer observations about resource gaps by geography and family type, generating a dynamic community resource gap map updated in real time. | **Must Have** | Community gap map |
| **VOL-08** | AI retention model shall identify early disengagement signals from feedback patterns and trigger proactive coordinator outreach. | **Should Have** | Volunteer retention prediction |

## **6.3  Attorneys**

Attorneys provide structured, legally consequential feedback. All attorney submissions receive automatic privilege tagging and route through a legal review gate before entering shared analytics pipelines.

| ID | Requirement | Priority | Notes |
| :---- | :---- | :---- | :---- |
| **ATT-01** | System shall generate a structured feedback form triggered on each legal document due-date milestone recorded in iFamilyNet. | **Must Have** | Linked to case milestones table |
| **ATT-02** | Form shall capture quantitative scores for: document production timeliness, case record completeness, service plan adherence, and communication responsiveness. | **Must Have** | 5-point scale per domain |
| **ATT-03** | Attorney feedback shall be linked to specific case IDs only (not individual caseworker PII) for aggregate case-level reporting. | **Must Have** | Case ID foreign key only |
| **ATT-04** | System shall support digital signature or attestation on legal feedback submissions to establish accountability. | **Must Have** | DCF legal requirement |
| **ATT-05** | Forms shall support structured multi-select fields for identifying specific document types that were late or incomplete. | **Must Have** | Enables root-cause analysis |
| **ATT-06** | Attorney feedback shall be exportable in CSV and PDF formats for legal record-keeping. | **Must Have** | On-demand export from admin portal |
| **ATT-07** | System shall send automated reminders to attorneys if a milestone form has not been submitted within 5 business days. | **Should Have** | Configurable reminder cadence |
| **ATT-08** | AI shall automatically apply privilege-protection tagging to all attorney submissions before they enter any shared analytics pipeline. | **Must Have** | Legal data governance |
| **ATT-09** | AI shall flag any attorney feedback mentioning ICWA or ICPC compliance concerns and route immediately to DCF's legal and policy office. | **Must Have** | Federal compliance stakes |

## **6.4  Foster Parents**

Foster Parents provide the most direct measure of placement quality. AI maintains a longitudinal placement quality profile for each active placement and flags stability risks before disruption occurs.

| ID | Requirement | Priority | Notes |
| :---- | :---- | :---- | :---- |
| **FP-01** | System shall initiate a longitudinal feedback sequence for each foster parent at placement day 30, day 60, day 90, and at case closure. | **Must Have** | Triggered by placement milestones |
| **FP-02** | Survey domains shall include: caseworker visit frequency & quality, responsiveness, support for children with complex needs, and placement stipend timeliness. | **Must Have** | Domain list reviewed with DCF |
| **FP-03** | Each survey instance shall be linked to the specific placement ID in iFamilyNet, enabling longitudinal trend analysis per placement. | **Must Have** | Placement ID foreign key |
| **FP-04** | Foster parents shall receive in-portal notifications and optional email reminders for pending surveys. | **Must Have** | Portal \+ email dual-channel |
| **FP-05** | System shall flag significantly low scores (below configurable threshold) for immediate supervisor review. | **Must Have** | Real-time alert to supervisor queue |
| **FP-06** | Foster parent responses shall be anonymised in aggregate dashboards but retained with placement ID linkage for supervisors with appropriate access. | **Must Have** | Role-based data visibility |
| **FP-07** | Case closure survey shall include an overall satisfaction rating and an open-ended narrative field (max 1,000 characters). | **Should Have** | Qualitative insight at closure |
| **FP-08** | AI shall maintain a time-series placement quality profile per active placement, alerting supervisors when patterns suggest elevated disruption risk. | **Must Have** | Longitudinal stability model |
| **FP-09** | AI retention risk model shall identify foster families showing declining engagement patterns and trigger proactive licensing worker outreach. | **Should Have** | Foster parent retention |

# **7\. AI Capability Requirements**

The following seven AI capabilities constitute the core intelligence layer of the Centralized Feedback System. All seven are non-optional design requirements, not optional add-ons.

| \# | Capability | Description |
| :---- | :---- | :---- |
| **1** | **Intelligent Intake — AI-Powered Submission Assistance** | When a user opens a feedback form, AI guides the submission in real time. As the user types a free-text narrative, NLP classifies the topic, suggests the most relevant category, and flags urgent or safety-related concerns. For mandated reporters, the system auto-populates known fields from the report record. For foster parents, AI pre-fills area office, caseworker assignment, and placement details — reducing abandonment and ensuring urgent submissions are flagged at point of entry. |
| **2** | **NLP Pipeline — Automated Categorization & Tagging** | Every free-text submission is processed immediately upon receipt across five operations: (1) topic classification across 12 defined categories; (2) sentiment scoring on a 5-point scale; (3) urgency detection for language patterns associated with child safety or caseworker misconduct; (4) named entity recognition for processes, policies, or systemic issues; and (5) topic modeling for emergent themes. The pipeline runs in under 2 seconds per submission. |
| **3** | **Anomaly Detection & Trend Analysis** | The analytics engine continuously monitors the feedback corpus for statistically significant patterns: volume anomalies (40%+ submission spikes from a specific office within 7 days), sentiment anomalies (sustained 30-day satisfaction decline), and topic anomalies (emerging themes not matching existing categories). Structured alerts include supporting anonymized submissions and route to the appropriate supervisor or director. |
| **4** | **Predictive Analytics — From Reactive to Proactive** | Three predictive use cases: (1) Workforce risk prediction — identifying area offices at elevated staff turnover or burnout risk; (2) Training need forecasting — detecting curriculum gaps before they affect outcomes; (3) CFSR outcome prediction — correlating multi-year feedback patterns with federal review findings, enabling proactive compliance gap remediation before the formal review cycle. |
| **5** | **Generative AI — Automated Reporting & Summarization** | AI produces: a weekly Area Office Feedback Brief (2-page narrative summary); a monthly Division Report (cross-office comparison with trend analysis and recommended actions); and a quarterly CQI Evidence Package structured to align with CFSR outcome domains. Each report is generated from the live data corpus, reviewed by a designated staff member, and published — eliminating weeks of manual synthesis. |
| **6** | **Closed-Loop AI — Automated Response & Follow-Up** | Every user receives an AI-generated confirmation upon submission. For routine submissions, AI generates a personalized response within 24 hours referencing the specific concern. For high-urgency items, AI drafts a response for a human supervisor to review and send. A 30-day follow-up survey closes the loop on whether the concern was addressed — creating a quality signal on the system itself. |
| **7** | **Equity & Bias Monitoring** | AI disaggregates every feedback metric by user demographics (where voluntarily provided), area office, and case type. Any metric where the gap between demographic subgroups exceeds a statistically significant threshold is automatically flagged and routed to DCF's Office of Diversity, Equity, and Inclusion alongside the relevant area office director — transforming feedback data into an active equity accountability tool. |

# **8\. AI Technical Architecture**

## **8.1  The Five-Layer AI Stack**

| Layer | Components | Infrastructure |
| :---- | :---- | :---- |
| **Layer 1 — Ingestion AI** | Smart form assistance, auto-populate, urgency pre-flagging | Azure Cognitive Services Form Recognizer; real-time NLP via FastAPI |
| **Layer 2 — NLP Pipeline** | Topic classification, sentiment scoring, urgency detection, NER, topic modeling | Azure OpenAI GPT-4 fine-tuned on DCF corpus; spaCy for NER; BERTopic for topic modeling |
| **Layer 3 — Analytics AI** | Anomaly detection, trend analysis, equity disaggregation, KPI alerting | Azure Machine Learning; scikit-learn / statsmodels; Power BI Embedded dashboards |
| **Layer 4 — Predictive Models** | Placement stability, volunteer retention, CFSR forecasting, workforce risk | Azure ML AutoML; XGBoost / LightGBM; retrained quarterly on updated data |
| **Layer 5 — Generative AI** | Automated report drafting, closed-loop responses, executive summaries | Azure OpenAI GPT-4; human-in-the-loop review before publication; RAG on DCF policy corpus |

## **8.2  Data & Model Governance**

* Model cards for every deployed model documenting training data, intended use, known limitations, and performance metrics by demographic subgroup.

* Quarterly bias audits: all classification and prediction models tested for differential performance across race, geography, and user group — results reported to DCF's equity office.

* Human override requirements: no AI output directly triggers a consequence — all model outputs are recommendations requiring human review and approval.

* Explainability standards: every alert, flag, or recommendation generated by AI includes a plain-language explanation of the supporting evidence.

* Retraining schedule: all models retrained at minimum quarterly; significant policy or process changes trigger an ad hoc retraining cycle.

* Data minimisation: AI models trained and operated on the minimum data necessary; verbatim submissions never used as training data without explicit anonymisation review.

## **8.3  Privacy & Security by Design**

All AI processing occurs within DCF's Azure Government Cloud environment — no data leaves the Commonwealth's controlled infrastructure. Specific protections include:

* Automatic PII detection and redaction before any submission enters the analytics layer.

* Child identifier firewall: submissions containing child-specific information are segregated into a restricted tier inaccessible to the aggregated analytics layer.

* Attorney-client privilege tagging: attorney submissions are automatically tagged and routed through a legal review gate.

* Differential privacy for small-group analytics: for demographic subgroups with fewer than 10 members at area office level, differential privacy techniques prevent re-identification.

# **9\. Administrative & Portal Requirements**

| ID | Requirement | Priority | Notes |
| :---- | :---- | :---- | :---- |
| **ADM-01** | The DCF Partner Portal shall present four distinct, access-controlled sections — one per user group — visible only to authenticated users with the corresponding role. | **Must Have** | Role-based access control (RBAC) |
| **ADM-02** | DCF administrators shall have access to a central dashboard displaying response rates, aggregate scores, trends over time, AI-generated flags, and equity metrics for each user group. | **Must Have** | Real-time AI-powered dashboard |
| **ADM-03** | Dashboard shall support filtering by date range, user group, case type, region/office, priority flags, and demographic subgroup. | **Must Have** | Multi-dimension filtering |
| **ADM-04** | Administrators shall be able to configure survey trigger timing, expiry windows, reminder cadences, score alert thresholds, and AI model parameters without developer intervention. | **Must Have** | Admin configuration UI |
| **ADM-05** | System shall provide export functionality for all feedback data in CSV and PDF formats. | **Must Have** | On-demand export |
| **ADM-06** | All feedback submissions shall be time-stamped and retained for a minimum of 7 years per DCF data retention policy. | **Must Have** | Audit/compliance requirement |
| **ADM-07** | The system shall generate automated weekly, monthly, and quarterly AI-drafted summary reports, delivered to designated DCF leadership recipients. | **Should Have** | Configurable distribution list |
| **ADM-08** | Flagged high-priority items (Foster Parent low scores, Attorney escalations, Volunteer resource gaps, AI anomaly alerts) shall appear in a unified supervisor action queue with status tracking. | **Must Have** | Tracks open/resolved state |
| **ADM-09** | AI governance dashboard shall display current model performance metrics, bias audit status, and retraining schedule for all deployed models. | **Must Have** | AI governance compliance |

# **10\. Non-Functional Requirements**

| Category | Requirement |
| :---- | :---- |
| **Performance** | Survey pages shall load within 2 seconds on standard broadband; dashboard queries shall return within 5 seconds for datasets up to 500,000 records; AI NLP pipeline shall complete processing within 2 seconds per submission. |
| **Availability** | System shall target 99.5% uptime during business hours (6am–10pm Eastern); scheduled maintenance windows communicated 72 hours in advance. |
| **Security** | All data in transit encrypted via TLS 1.3; data at rest encrypted via AES-256. Hosted on DCF-approved Azure Government Cloud infrastructure. |
| **Accessibility** | All portal pages shall comply with WCAG 2.1 AA accessibility standards. |
| **Scalability** | System shall support concurrent access by up to 2,000 users without performance degradation; architecture shall support horizontal scaling. |
| **Data Privacy** | System shall comply with HIPAA, Massachusetts 201 CMR 17.00, and all applicable DCF data governance policies. No PII shall appear in aggregate reporting views. |
| **AI Ethics** | No AI output shall trigger an automated consequence. All AI classifications, flags, alerts, and generated reports require human review before action. Plain-language disclosures of AI processing are mandatory at point of submission. |
| **Audit Logging** | All user actions and AI processing events (classification, flag, alert generation) shall be logged with timestamp, user ID, and action details. |
| **Browser Support** | System shall support current versions of Chrome, Firefox, Safari, and Edge; mobile support for iOS 15+ and Android 12+. |

# **11\. Integration Requirements**

| System | Integration Requirement |
| :---- | :---- |
| **iFamilyNet** | Event hooks on: 51A filing, volunteer event completion, legal milestone dates, placement record milestones, and case closure. Read access to case IDs, placement IDs, and event timestamps. No write-back to core iFamilyNet records. |
| **DCF Identity Provider** | Single Sign-On (SSO) via DCF's existing identity provider; role attributes passed as claims to enforce portal section access. |
| **Azure Government Cloud** | All AI processing — NLP pipeline, predictive models, generative AI — executed within DCF's Azure Government Cloud environment. No data leaves the Commonwealth's controlled infrastructure. |
| **Azure OpenAI Service** | GPT-4 model API for NLP topic classification, sentiment scoring, generative report drafting, and closed-loop response generation. |
| **Power BI Embedded** | Dashboard layer for real-time aggregate metrics, trend visualisation, and equity disaggregation views. |
| **Email / Notification Gateway** | Integration with DCF's approved email gateway for survey dispatch, reminders, escalation alerts, and AI-generated closed-loop responses. |
| **DCF SIEM** | Audit log stream exportable to DCF's Security Information and Event Management system in standard syslog format. |
| **Phase 2 — Analytics** | Integration with Augintel analytics layer or InApp-native AI analytics within iFamilyNet for advanced predictive modelling. |

# **12\. Expected Impact & Key Metrics**

## **12.1  System Performance Metrics**

| Metric | Baseline (manual) | Year 1 Target | Year 2 Target |
| :---- | :---- | :---- | :---- |
| Avg. feedback processing time | \> 5 days | \< 4 hours | \< 1 hour |
| % submissions auto-classified | 0% | 85% | 95% |
| Urgency flag accuracy | N/A | \> 88% | \> 93% |
| Closed-loop response rate | \< 10% | \> 70% | \> 90% |
| Trend alert lead time | Weeks | \< 72 hours | \< 24 hours |
| Quarterly report generation time | 3–4 weeks | \< 2 hours (AI draft) | Automated \+ review |

## **12.2  User Engagement Targets**

| User Group | Target Engagement Metric |
| :---- | :---- |
| **Mandated Reporters** | 65% post-report survey response rate within 7 days of 51A filing |
| **Volunteers** | 80% completion rate on quarterly pulse surveys; \< 15% annual attrition rate |
| **Attorneys** | 50% of active GALs and family attorneys submitting at least one feedback record per quarter |
| **Foster Parents** | 70% of active foster families submitting at least one longitudinal feedback record per placement |

## **12.3  Quality Improvement Outcomes**

| Outcome | Success Indicator |
| :---- | :---- |
| **Process improvements actioned** | At least 6 documented process or policy changes directly attributable to feedback intelligence per year |
| **Training curriculum updates** | At least 4 training content updates per year driven by AI-identified feedback gaps |
| **Placement stability improvement** | 5% reduction in placement disruption rate year-over-year in cohort using AI predictive alerts |
| **CFSR readiness** | All CFSR outcome evidence packages auto-generated from feedback data, reducing manual preparation by \> 60% |
| **Foster parent retention** | 10% improvement in foster family retention rate within 2 years of deployment |
| **Equity gap reduction** | Measurable reduction in satisfaction score disparity between demographic subgroups within 18 months |

# **13\. Implementation Roadmap**

| Phase | AI Capabilities Activated | User Groups Live | Timeline |
| :---- | :---- | :---- | :---- |
| Phase 1 | NLP topic classification & sentiment; urgency detection; real-time dashboards; automated acknowledgement | Mandated Reporters | Months 1–6 |
| Phase 2 | Trend & anomaly detection; equity disaggregation; volunteer engagement modeling; closed-loop AI responses | Mandated Reporters \+ Volunteers | Months 7–12 |
| Phase 3 | Generative AI report drafting; attorney privilege tagging; foster parent longitudinal tracking; placement stability model | All 4 user groups | Months 13–18 |
| Phase 4 | Predictive CFSR forecasting; retention models; workforce risk signals; full automated reporting suite | All 4 groups — full capability | Months 19–24 |

| Phase 1 Priority — Start with Mandated Reporters: Mandated reporters represent the highest-frequency, most legally significant feedback population. Their feedback directly measures the quality of DCF's most time-critical process — 51A intake. Starting here generates the largest dataset the fastest, enabling the NLP and analytics layers to be trained on real Massachusetts DCF data before expanding to the other three groups. |
| :---- |

# **14\. Ethical Guardrails & AI Governance**

The following guardrails are non-negotiable design requirements — not optional add-ons — and must be established and verified before any AI capability is activated in production.

| Guardrail | Requirement |
| :---- | :---- |
| **Human-in-the-loop** | No AI output triggers an automated consequence. Every classification, flag, alert, and generated report requires a human to review, approve, and act. AI is advisory — humans decide. |
| **No adverse action from feedback** | Feedback data is never used directly to evaluate, discipline, or penalize individual caseworkers. Aggregate patterns may inform supervision and training, but never individual performance reviews without a separate documented human review process. |
| **Transparency to submitters** | Every submitter is informed at the point of submission that their feedback will be processed by AI classification tools. Plain-language disclosure is mandatory. Opt-out from AI processing must be available. |
| **Bias audit requirement** | All models must pass a pre-deployment bias audit demonstrating no statistically significant performance disparity across race, gender, geography, or language. Audit results are published to DCF's equity office before deployment and repeated quarterly. |
| **Data sovereignty** | All AI processing occurs within the Commonwealth of Massachusetts' Azure Government Cloud. No feedback data is processed by third-party commercial AI services outside DCF's data governance controls. |
| **Model explainability** | Every AI output displayed to a user — alert, classification, summary, or prediction — must include a plain-language explanation of the primary factors driving that output. Black-box outputs are not permitted. |
| **Community oversight** | Feedback from all four user groups about the AI features themselves is collected and reviewed quarterly by a cross-functional AI governance committee including representatives from each user group. |

# **15\. Acceptance Criteria**

| \# | Acceptance Criterion | Test Method |
| :---- | :---- | :---- |
| **1** | Mandated Reporter survey is automatically dispatched 5–7 days after a test 51A event in the staging iFamilyNet environment. | Integration test |
| **2** | All four portal sections are accessible only by users with the corresponding role; cross-role access is denied. | Role-based penetration test |
| **3** | Attorney milestone form is generated and delivered on the exact date of a simulated legal milestone. | Integration test |
| **4** | Foster parent longitudinal survey sequence fires at day 30, 60, 90, and case closure for a simulated placement record. | End-to-end test |
| **5** | A Foster Parent survey score below the configured alert threshold triggers a real-time supervisor notification. | Functional test |
| **6** | Admin dashboard loads correct aggregate data within 5 seconds for a 100,000-record test dataset. | Performance test |
| **7** | NLP pipeline classifies 95% of test submissions with accuracy verified against a human-labeled validation set. | AI model validation |
| **8** | AI urgency detection correctly flags \> 88% of test submissions containing safety-related language. | AI model validation |
| **9** | All exported CSV and PDF reports contain correct data with no PII in aggregate views. | Data validation / privacy test |
| **10** | All portal pages achieve WCAG 2.1 AA compliance as verified by an automated accessibility scanner. | Accessibility audit |
| **11** | System sustains 500 concurrent simulated user sessions without error rates exceeding 0.1%. | Load test |
| **12** | Audit log captures all test user and AI processing actions with correct timestamps, user IDs, and action types. | Audit log review |
| **13** | AI bias audit confirms no statistically significant performance disparity across race, geography, or user group in a pre-deployment test. | Bias audit |

# **16\. Open Items & Decisions Required**

| Item | Description / Action Required |
| :---- | :---- |
| **OI-01** | Survey Domain Sign-off: DCF programme leads must review and formally approve the specific questions within each survey domain. Owner: DCF Programme / InApp BA. Target: 2 weeks from BRD approval. |
| **OI-02** | Attorney Attestation Format: DCF Legal must confirm whether attorney feedback attestation requires a qualified electronic signature or a portal-based confirmation. Owner: DCF Legal. Target: 3 weeks from BRD approval. |
| **OI-03** | iFamilyNet Event API Scope: DCF IT must confirm availability and format of iFamilyNet event hooks for integration. Owner: DCF IT / InApp Tech Lead. Target: 2 weeks from BRD approval. |
| **OI-04** | Data Retention Duration: DCF Compliance must confirm the required data retention period for feedback records (BRD assumes 7 years). Owner: DCF Compliance. Target: BRD approval. |
| **OI-05** | AI Governance Framework: DCF must formally establish the AI governance framework — model card requirements, bias audit schedule, human override policy, and governance committee composition — before Phase 1 deployment. Owner: DCF IT / DCF Leadership. Target: 4 weeks from BRD approval. |
| **OI-06** | Phase 2 Analytics Scope: Decision required on whether Phase 2 integration is with Augintel or InApp-native AI analytics within iFamilyNet. Owner: DCF Leadership / InApp BD. Target: Q4 2026\. |
| **OI-07** | AI Opt-Out Mechanism: DCF Legal and Compliance must confirm the required design for the AI processing opt-out flow for each user group. Owner: DCF Legal / InApp BA. Target: 3 weeks from BRD approval. |

# **17\. Document Revision History**

| Version | Date | Author | Changes |
| :---- | :---- | :---- | :---- |
| 1.0 | May 2026 | InApp — HHS Practice | Initial draft for DCF review. AI capabilities layer integrated from AI-Assisted Feedback System design document. |

— End of Document —

Confidential  |  InApp HHS Practice  |  Massachusetts DCF