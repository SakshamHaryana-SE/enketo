FROM ubuntu:focal

WORKDIR /vagrant
COPY . .
RUN QUIET=true MINIMAL=true . setup/bootstrap.sh

EXPOSE 8095
CMD ["npm", "start"]
