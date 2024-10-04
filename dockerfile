# Use the official Node.js image
FROM node:18

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./ 

# Install dependencies
RUN npm install

# Copy the rest of your application files
COPY . .

# Install concurrently
RUN npm install -g concurrently

# Expose the port your Next.js app runs on
EXPOSE 3000

# Start the Next.js app and Convex
CMD ["concurrently", "npm run dev", "npx convex dev"]