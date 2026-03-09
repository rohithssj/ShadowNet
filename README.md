ShadowNet – Intelligent Cybersecurity Monitoring Platform
Overview

ShadowNet is an intelligent cybersecurity monitoring platform designed to identify vulnerable and forgotten devices within an organization's network infrastructure. The system analyzes device metadata such as IP address, open ports, protocol usage, patch history, and system uptime to evaluate security risks and highlight potential attack surfaces.

The platform provides a centralized dashboard that allows security teams to monitor device risk levels, visualize security trends, and identify legacy systems that may introduce vulnerabilities into the network.

ShadowNet was initially developed as part of a cybersecurity hackathon project focused on improving visibility into unmanaged or forgotten network devices within government and enterprise environments.

Problem Statement

Large organizations often operate complex networks consisting of hundreds or thousands of connected devices, including servers, workstations, printers, scanners, biometric systems, kiosks, and IoT devices. Over time, some of these systems become unmanaged or remain operational without regular updates.

Such devices create hidden attack surfaces that can be exploited by attackers. Traditional security monitoring tools frequently rely on predefined asset inventories, which means unknown or forgotten devices may remain undetected.

ShadowNet addresses this challenge by analyzing device lifecycle indicators and exposure characteristics to identify potential risks within the network.

Key Features
Device Risk Analysis

ShadowNet evaluates device risk using multiple indicators including open ports, protocol exposure, patch age, and system uptime. These factors are combined to generate a normalized risk score and categorize devices into different security levels such as Low, Medium, High, and Critical.

Predictive Risk Insights

The platform provides predictive insights by projecting potential future risk levels for devices based on their current exposure and lifecycle conditions. This allows organizations to identify systems that may become critical if they remain unpatched or unmanaged.

Forgotten Device Detection

ShadowNet identifies devices that have been running for extended periods without updates. These legacy systems are highlighted because they often represent hidden entry points for attackers within the infrastructure.

Real Time Risk Monitoring

The dashboard includes a simulated live monitoring feed that highlights devices with abnormal risk indicators or elevated security concerns. This helps demonstrate how a security operations center (SOC) might monitor network activity continuously.

Security Score and Attack Surface Index

ShadowNet calculates an overall network security score based on device exposure levels and infrastructure health. This provides a quick snapshot of the organization’s security posture and highlights the overall attack surface of the network.

Explainable Risk Insights

For every high-risk device, the platform displays detailed explanations describing the factors contributing to the risk. These insights help security teams understand why a device has been flagged and what corrective action should be taken.

Network Asset Visualization

The platform provides visual representations of network devices, helping security teams understand how infrastructure assets are distributed across the network.

Data Input Methods
Manual Device Entry

Users can manually enter device metadata using the upload interface. Required fields include:

IP address
Port
Protocol
Last patch year
System uptime (days)

CSV or Excel Dataset Upload

Organizations can upload datasets containing device metadata.

Supported file formats:

CSV
Excel (.xlsx)

Required dataset columns:

ip
port
protocol
last_patch_year
uptime

Once uploaded, the dataset is processed locally and used to generate analytics within the dashboard.

Security and Data Handling

ShadowNet processes uploaded device metadata entirely within the browser environment. Device datasets are stored temporarily using session storage to ensure that sensitive infrastructure information is not retained beyond the active session.

Key security considerations include:

Session-based data storage
No external transmission of device metadata
Automatic data clearance when the browser session ends

This approach ensures that network information remains on the user’s system and is not stored on external servers.

Technology Stack

Frontend
HTML
CSS
JavaScript

Visualization
Chart.js

File Processing
CSV parsing
Excel parsing using SheetJS

Deployment
Netlify

System Architecture

User Login
→ Data Upload or Manual Entry
→ Device Data Processing
→ Risk Analysis Engine
→ Predictive Risk Evaluation
→ Dashboard Visualization and Alerts

Use Cases

Enterprise Network Security Monitoring
Government Infrastructure Risk Assessment
Security Operations Center Dashboards
Cybersecurity Education and Training

Future Improvements

Integration with automated network discovery tools
Integration with vulnerability intelligence databases such as CVE and NVD
Machine learning models for behavioral anomaly detection
Role-based access control for enterprise environments
Secure backend storage with encrypted databases
Integration with security information and event management (SIEM) platforms

Conclusion

ShadowNet demonstrates how device lifecycle indicators and network exposure metrics can be used to identify hidden vulnerabilities in modern IT environments. By combining intelligent risk analysis, predictive insights, and visual monitoring, the platform enables organizations to proactively reduce their cyber attack surface and improve infrastructure resilience.