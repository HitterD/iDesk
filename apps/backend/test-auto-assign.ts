process.env.JWT_SECRET = "supersecretkeythatisatleast32charslong";
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { WorkloadService } from './src/modules/workload/workload.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Ticket } from './src/modules/ticketing/entities/ticket.entity';
import { User } from './src/modules/users/entities/user.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const workloadService = app.get(WorkloadService);
  const ticketRepo = app.get(getRepositoryToken(Ticket));
  const userRepo = app.get(getRepositoryToken(User));
  
  const tickets = await ticketRepo.find({ take: 5, relations: ['assignedTo'] });
  
  if (tickets.length > 0) {
      console.log('Testing with siteId:', tickets[0].siteId);
      
      const agents = await userRepo.find({ where: { siteId: tickets[0].siteId } });
      console.log('Total users in this site:', agents.length);
      console.log('Roles:', agents.map((a: any) => `${a.fullName} - ${a.role} - isActive: ${a.isActive}`));
      
      try {
          const assignedTicket = await workloadService.autoAssignTicket(tickets[0].id);
          console.log('Auto assigned ticket to:', assignedTicket.assignedTo ? assignedTicket.assignedTo.fullName : 'None');
          
          const agent = await workloadService.findBestAgentForAssignment(tickets[0].siteId);
          console.log('Next best agent found:', agent ? agent.fullName : 'None');
      } catch (err) {
          console.error(err);
      }
  } else {
      console.log('No tickets found to get a siteId');
  }
  
  await app.close();
}

bootstrap().catch(console.error);
