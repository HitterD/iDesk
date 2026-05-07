const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { WorkloadService } = require('./dist/modules/workload/workload.service');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { Ticket } = require('./dist/modules/ticketing/entities/ticket.entity');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const workloadService = app.get(WorkloadService);
  const ticketRepo = app.get(getRepositoryToken(Ticket));
  
  // Find a ticket to test with, or just test findBestAgentForAssignment
  const tickets = await ticketRepo.find({ take: 5, relations: ['assignedTo'] });
  
  if (tickets.length > 0) {
      console.log('Testing with siteId:', tickets[0].siteId);
      try {
          const agent = await workloadService.findBestAgentForAssignment(tickets[0].siteId);
          console.log('Best agent found:', agent ? agent.fullName : 'None');
      } catch (err) {
          console.error(err);
      }
  } else {
      console.log('No tickets found to get a siteId');
  }
  
  await app.close();
}

bootstrap().catch(console.error);
