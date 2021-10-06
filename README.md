# Jupiter Metis  

We’re all familiar with using our favorite chat apps and we often just assume we can trust them with our personal information. It’s not until our private life is compromised do we suddenly reconsider how we’re doing things. 

Next generation chat application Metis improves your privacy by defaulting to locally encrypt all communications before sending any message.

With Jupiter Metis, you always have the power over your privacy and what, if anything, is shared. No central servers store any information about you, your account, or conversations. There’s no signup required and participating in group chats is as simple and secure as it gets.

Metis runs on the blockchain and is 100% encrypted with AES-256 encryption. By using blockchain to talk, you’re protecting your communications and keeping your chats private!

Try the [mobile app](https://getmetis.io) and then build your own instance!

1. Clone Metis
2. Install Dependencies
    - Nodejs - https://nodejs.org/en/download/ and follow directions for your OS
    - Redis - https://www.digitalocean.com/community/tutorials/how-to-install-and-secure-redis-on-ubuntu-18-04
    - Run `npm install`
3. Download Jupiter wallet and create Jupiter address for your Metis instance
    - Navigate to https://github.com/jupiter-project/jupiter/releases to download and for installation instructions
4. Buy Jupiter, send at least 1000 Jupiter (or more) to the address you created
    - This will activate your Metis application and allow you to send messages to your friends
5. Modify the .env file
    - Get the public key, JUP address, passphrase and replace the placeholders in .env file
6. Start the metis application
    - To start Metis, type in `npm run start`
7. Open your browser and type in 127.0.0.1:4000

This is a 100% local instance of Metis that talks to Jupiter's blockchain. Anyone can complete these steps and create their own private, encrypted, and shielded communications. Even though this is a local only instance, you can log into ANY Metis instance with your credentials and it will still work and have all your past conversations waiting for you! This is due to all your conversations being encrypted and stored on Jupiter's decentralized blockchain.
