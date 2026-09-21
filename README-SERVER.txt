DCF Feedback Analytics — copy to server, unzip, run (PM2)

Prerequisites on the Ubuntu host: sudo, unzip, and internet (first run
installs Node.js 20, build tools, and pm2 if they are missing).

1. Copy dcf-feedback-linux.zip to the server.

2. Unzip and start:

     sudo mkdir -p /var/www/dcf-feedback
     sudo unzip -o dcf-feedback-linux.zip -d /var/www/dcf-feedback
     cd /var/www/dcf-feedback
     sudo bash start.sh

   First run creates or fills deploy/.env (HF token is packaged in the zip
   from this repo's gitignored .env files), installs dependencies, builds
   the frontend and backend, seeds demo data, starts PM2, and writes the
   nginx snippet for /feedback/.

     Loopback  http://127.0.0.1:14020/feedback/
     Health    http://127.0.0.1:14020/feedback/v1/health

3. Persist after reboot:

     pm2 save
     pm2 startup          # then run the printed sudo command

4. Nginx: start.sh writes /etc/nginx/snippets/dcf-feedback.conf and
   tries to include it in the existing client-demo.inapp.com 443 vhost.
   It does not replace location / or /fostercare/. Re-run:

     sudo bash deploy/configure-nginx.sh

   Public URL:

     https://client-demo.inapp.com/feedback/

Skip nginx: sudo bash start.sh --no-nginx

Useful commands (from /var/www/dcf-feedback):

     pm2 status
     pm2 logs dcf-feedback-api
     pm2 restart dcf-feedback-api
     sudo bash start.sh --no-nginx --no-seed    # update without rebuild of nginx/DB
     sudo bash start.sh --seed                  # re-seed demo users

Demo logins (password: demo)

     admin_demo        admin
     supervisor_demo   supervisor
     mr_demo           mandated_reporter

Optional: set HF_API_TOKEN in deploy/.env, docker/.env, or
codebase/backend/.env on the build machine. create-archive.sh copies it
into the zip; start.sh fills deploy/.env on the server. No extra step.
