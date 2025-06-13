FROM 319138211689.dkr.ecr.us-east-2.amazonaws.com/dev-api

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN yarn
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 7000
CMD [ "node", "src/cluster.js" ]
