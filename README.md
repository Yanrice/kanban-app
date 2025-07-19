# Kanban Board Application

## Overview

This is a multi-user Kanban board application built with a `Node.js/Express` backend and a vanilla JavaScript frontend, using an in-memory `SQLite` database for lightweight data storage. The project showcases DevOps practices, including a **CI/CD** pipeline with Jenkins, deployment to **AWS EC2**, and adaptability for multiple environments (development, testing, production). It demonstrates skills in automation, infrastructure management, and secure application deployment.

### Features

* **User Authentication:** Register and login with JWT-based authentication.
* **Kanban Boards:** Create, view, and manage boards with columns ("To Do", "In Progress", "Done") and tasks.
* **Task Management:** Add, update, and delete tasks with priorities and positions.
* **In-Memory Database:** Uses SQLite in-memory for fast, non-persistent storage (ideal for development/testing).
* **CI/CD Pipeline:** Jenkins pipeline for automated deployment to AWS EC2 or other environments.
* **Environment Flexibility:** Configurable for local development, cloud servers, or containerized setups.

## Tech Stack

* **Backend:** Node.js, Express, SQLite (in-memory), bcryptjs, jsonwebtoken
* **Frontend:** HTML, CSS, vanilla JavaScript
* **DevOps:** Jenkins (CI/CD), AWS EC2, GCP VM, systemd for process management
* **Other Tools:** Git, npm, SSH for deployment

## Repository Structure

kanban-board-app/
├── public/                * Frontend assets
│   ├── css/               * CSS styles
│   │   └── styles.css
│   ├── js/                * JavaScript for frontend logic
│   │   ├── app.js
│   │   ├── auth.js
│   │   └── board.js
│   └── index.html         * Main HTML file
├── .github/               * GitHub Actions for CI (optional)
│   └── workflows/
│       └── ci.yml
├── .env.example           # Example environment variables
├── .gitignore             # Files to ignore in Git
├── Jenkinsfile            # Jenkins pipeline for CI/CD
├── package.json           # Node.js dependencies and scripts
├── server.js              # Backend server code
└── README.md              # Project documentation

## Prerequisites

Node.js: v18 or later
npm: v9 or later
Git: For cloning the repository
AWS Account: For EC2 deployment (Free Tier eligible)
GCP Account: For Jenkins VM (Free Tier eligible)
Jenkins: Installed on GCP VM
SSH Key: For secure deployment to EC2

Setup Instructions
Local Development

### Clone the Repository:

`git clone https://github.com/<your-username>/kanban-board-app.git`

`cd kanban-board-app`

### Install Dependencies:

`npm install`

### Configure Environment:

Copy `.env.example` to `.env:`

`cp .env.example .env`

Edit `.env` with a secure `JWT_SECRET:`

`PORT=3000`

`JWT_SECRET=your-secure-secret`

### Run the Application:

`npm start`

Access at `http://localhost:3000`.

### Development Mode (with auto-restart):

`npm run dev`

Deployment to AWS EC2
This section describes deploying to an AWS EC2 t4g.micro instance (Free Tier eligible, ~$7-8/month On-Demand otherwise) using a Jenkins pipeline on a GCP VM.
EC2 Setup

Launch EC2 Instance:
AMI: Ubuntu Server 22.04 LTS (ARM-based).
Instance Type: t4g.micro (2 vCPUs, 1 GiB RAM).
Key Pair: Create/download kanban-key.pem.
Security Group: Allow:
SSH (port 22): From Jenkins VM IP or 0.0.0.0/0 (restrict later).
TCP (port 3000): 0.0.0.0/0.


Storage: 8 GiB gp3 EBS (Free Tier eligible).


Install Dependencies:
SSH into EC2: ssh -i kanban-key.pem ubuntu@<EC2-Public-IP>.
Update system and install Node.js:sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm


Create app directory: mkdir ~/kanban-app.


Set Up systemd Service:
Create /etc/systemd/system/kanban-app.service:sudo nano /etc/systemd/system/kanban-app.service


Add:[Unit]
Description=Kanban Board Node.js Application
After=network.target

[Service]
ExecStart=/usr/bin/node /home/ubuntu/kanban-app/server.js
WorkingDirectory=/home/ubuntu/kanban-app
Restart=always
User=ubuntu
Environment=PORT=3000
Environment=JWT_SECRET=your-secure-secret

[Install]
WantedBy=multi-user.target


Enable and start:sudo systemctl daemon-reload
sudo systemctl enable kanban-app
sudo systemctl start kanban-app





Jenkins Setup on GCP VM

Install Jenkins:
On GCP VM: Follow official Jenkins installation for Ubuntu.
Access at http://<GCP-VM-Public-IP>:8080.


Install Plugins:
Go to Manage Jenkins > Manage Plugins > Available.
Install: Git, Publish Over SSH, Pipeline.


Configure SSH:
Go to Manage Jenkins > Configure System > Publish over SSH.
Add SSH Server:
Name: ec2-kanban.
Hostname: <EC2-Public-IP>.
Username: ubuntu.
SSH Key: Paste kanban-key.pem contents.
Test connection.




Create Pipeline:
New Item: Kanban-Pipeline, type Pipeline.
SCM: Git, URL: https://github.com/<your-username>/kanban-board-app.
Script Path: Jenkinsfile.
Save and run Build Now.



Jenkins Pipeline
The Jenkinsfile automates deployment:

Checks out code from GitHub.
Installs dependencies.
Deploys to EC2 via SSH, installs dependencies, and restarts the kanban-app service.
See Jenkinsfile for details.

Deployment to Other Environments
The app is adaptable for other environments (e.g., Azure, local servers, Heroku):

Local Server:
Follow "Local Development" steps.
Use systemd or pm2 (npm install -g pm2) for process management.


Other Clouds (e.g., Azure VM):
Similar to EC2 setup: Install Node.js, configure systemd, update Jenkinsfile with new SSH details.


PaaS (e.g., Heroku):
Add Procfile:web: node server.js


Update package.json:"scripts": {
  "start": "node server.js",
  "heroku-postbuild": "npm install"
}


Deploy with heroku git:push.


Persistent Database (Production):
Modify server.js to use file-based SQLite (new sqlite3.Database('./kanban.db')) or a managed database (e.g., AWS RDS PostgreSQL).
Example for PostgreSQL:
Add pg to package.json dependencies.
Update server.js to use pg client with connection string from environment variables.





Security Best Practices

JWT_SECRET: Store in AWS Secrets Manager or environment variables, not in code.
EC2 Security Group: Restrict SSH to Jenkins VM IP.
HTTPS: Use AWS ALB with ACM certificate for SSL.
Database: Switch to persistent storage (e.g., RDS) for production.
Logging: Enable CloudWatch Logs on EC2 for monitoring.

Future Improvements

Add unit/integration tests (e.g., Jest/Mocha).
Implement drag-and-drop for tasks in the frontend.
Add CI/CD for multiple environments (e.g., staging, production).
Use a process manager like PM2 for better Node.js management.

Contributing
Contributions are welcome! Please:

Fork the repository.
Create a feature branch (git checkout -b feature/new-feature).
Commit changes (git commit -m 'Add new feature').
Push to the branch (git push origin feature/new-feature).
Open a pull request.

License
MIT License
Contact
For questions or feedback, reach out via GitHub Issues or email at .
